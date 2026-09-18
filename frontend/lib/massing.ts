import { layoutExtents } from "./geometry";
import type { Layout, Opening, Wall } from "./types";

export type BuildMaterial = "stucco" | "stone" | "wood" | "glass" | "metal";

export type BuildSolid = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  material: BuildMaterial;
  name: string;
};

const STOREY = 3.15;
const SILL = 0.9;
const HEAD = 2.15;
const ROOF = 0.42;
const OVERHANG = 0.55;

export const MATERIAL_LOOK: Record<
  BuildMaterial,
  { color: string; roughness: number; metalness: number; opacity: number; transmission: number }
> = {
  stucco: { color: "#D9C7B0", roughness: 0.72, metalness: 0.04, opacity: 1, transmission: 0 },
  stone: { color: "#8A8178", roughness: 0.62, metalness: 0.12, opacity: 1, transmission: 0 },
  wood: { color: "#6B4423", roughness: 0.45, metalness: 0.08, opacity: 1, transmission: 0 },
  glass: { color: "#9FD8E0", roughness: 0.08, metalness: 0.15, opacity: 0.42, transmission: 0.72 },
  metal: { color: "#3D3A37", roughness: 0.28, metalness: 0.78, opacity: 1, transmission: 0 },
};

export function buildHouseSolids(layout: Layout): BuildSolid[] {
  const extents = layoutExtents(layout.rooms, layout.walls);
  const cx = (extents.minX + extents.maxX) / 2;
  const cy = (extents.minY + extents.maxY) / 2;
  const minX = extents.minX / 1000;
  const maxX = extents.maxX / 1000;
  const minY = extents.minY / 1000;
  const maxY = extents.maxY / 1000;
  const solids: BuildSolid[] = [];
  const addBox = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z0: number,
    z1: number,
    material: BuildMaterial,
    name: string,
  ) => {
    if (x1 - x0 < 0.03 || y1 - y0 < 0.03 || z1 - z0 < 0.02) return;
    solids.push({
      x: (x0 + x1) / 2 - cx / 1000,
      z: -((y0 + y1) / 2 - cy / 1000),
      y: (z0 + z1) / 2,
      w: x1 - x0,
      d: y1 - y0,
      h: z1 - z0,
      material,
      name,
    });
  };

  addBox(minX - 0.08, minY - 0.08, maxX + 0.08, maxY + 0.08, 0, 0.12, "wood", "Floor");
  addBox(minX - 2.4, minY - 2.4, maxX + 2.4, maxY + 2.4, -0.08, 0, "stone", "Site");

  layout.walls.forEach((wall, index) => {
    for (const part of wallParts(wall, layout.openings, index)) {
      addBox(part.x0, part.y0, part.x1, part.y1, part.z0, part.z1, part.material, part.name);
    }
  });

  layout.openings.forEach((opening, index) => {
    for (const part of openingParts(opening, index)) {
      addBox(part.x0, part.y0, part.x1, part.y1, part.z0, part.z1, part.material, part.name);
    }
  });

  const rx0 = minX - OVERHANG;
  const ry0 = minY - OVERHANG;
  const rx1 = maxX + OVERHANG;
  const ry1 = maxY + OVERHANG;
  addBox(rx0, ry0, rx1, ry1, STOREY, STOREY + ROOF, "metal", "Roof");
  const pz0 = STOREY + ROOF;
  const pz1 = pz0 + 0.38;
  const t = 0.12;
  addBox(rx0, ry0, rx1, ry0 + t, pz0, pz1, "stucco", "Parapet");
  addBox(rx0, ry1 - t, rx1, ry1, pz0, pz1, "stucco", "Parapet");
  addBox(rx0, ry0, rx0 + t, ry1, pz0, pz1, "stucco", "Parapet");
  addBox(rx1 - t, ry0, rx1, ry1, pz0, pz1, "stucco", "Parapet");

  return solids;
}

type Part = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  material: BuildMaterial;
  name: string;
};

function wallParts(wall: Wall, openings: Opening[], index: number): Part[] {
  const x0 = wall.start[0] / 1000;
  const y0 = wall.start[1] / 1000;
  const x1 = wall.end[0] / 1000;
  const y1 = wall.end[1] / 1000;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  if (length < 0.2) return [];
  const ux = dx / length;
  const uy = dy / length;
  const thick = Math.max(0.08, wall.thickness / 1000);
  const nx = -uy * (thick / 2);
  const ny = ux * (thick / 2);
  const material: BuildMaterial = wall.type === "exterior" ? "stone" : "stucco";

  const cuts: { lo: number; hi: number; opening: Opening }[] = [];
  for (const opening of openings) {
    const px = opening.position[0] / 1000;
    const py = opening.position[1] / 1000;
    const relx = px - x0;
    const rely = py - y0;
    const along = relx * ux + rely * uy;
    const dist = Math.abs(-uy * relx + ux * rely);
    if (dist > thick * 1.6 + 0.12) continue;
    const lo = along;
    const hi = along + opening.width / 1000;
    if (hi < 0.05 || lo > length - 0.05) continue;
    cuts.push({ lo: Math.max(0, lo), hi: Math.min(length, hi), opening });
  }
  cuts.sort((a, b) => a.lo - b.lo);

  const parts: Part[] = [];
  const seg = (a: number, b: number, z0: number, z1: number, name: string) => {
    const p0x = x0 + ux * a;
    const p0y = y0 + uy * a;
    const p1x = x0 + ux * b;
    const p1y = y0 + uy * b;
    const xs = [p0x + nx, p0x - nx, p1x + nx, p1x - nx];
    const ys = [p0y + ny, p0y - ny, p1y + ny, p1y - ny];
    parts.push({
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
      z0,
      z1,
      material,
      name,
    });
  };

  let cursor = 0;
  for (const cut of cuts) {
    if (cut.lo - cursor > 0.08) seg(cursor, cut.lo, 0, STOREY, `Wall-${index}`);
    const window = cut.opening.type === "window" || cut.opening.type === "casement";
    if (window) {
      seg(cut.lo, cut.hi, 0, SILL, `Sill-${index}`);
      seg(cut.lo, cut.hi, HEAD, STOREY, `Lintel-${index}`);
    } else {
      seg(cut.lo, cut.hi, HEAD, STOREY, `Lintel-${index}`);
    }
    cursor = cut.hi;
  }
  if (length - cursor > 0.08) seg(cursor, length, 0, STOREY, `Wall-${index}`);
  if (!cuts.length) seg(0, length, 0, STOREY, `Wall-${index}`);
  return parts;
}

function openingParts(opening: Opening, index: number): Part[] {
  const px = opening.position[0] / 1000;
  const py = opening.position[1] / 1000;
  const dx = opening.direction[0];
  const dy = opening.direction[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const w = opening.width / 1000;
  const nx = -uy * 0.04;
  const ny = ux * 0.04;
  const x1 = px + ux * w;
  const y1 = py + uy * w;
  const xs = [px + nx, px - nx, x1 + nx, x1 - nx];
  const ys = [py + ny, py - ny, y1 + ny, y1 - ny];
  if (opening.type === "window" || opening.type === "casement") {
    return [
      {
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
        z0: SILL + 0.04,
        z1: HEAD - 0.04,
        material: "glass",
        name: `Glass-${index}`,
      },
    ];
  }
  return [
    {
      x0: Math.min(px, px - uy * 0.8) - 0.03,
      y0: Math.min(py, py + ux * 0.8) - 0.03,
      x1: Math.max(px, px - uy * 0.8) + 0.03,
      y1: Math.max(py, py + ux * 0.8) + 0.03,
      z0: 0,
      z1: HEAD - 0.05,
      material: "wood",
      name: `Door-${index}`,
    },
  ];
}
