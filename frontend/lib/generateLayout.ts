import { packedToRoom, roomCentroid, sharedEdge, wallsFromRooms, type PackedRoom } from "./geometry";
import { defaultViews } from "./atelier";
import { createDetail } from "./details";
import type { Constraints, Detail, Layout, Opening, Point } from "./types";

const SQFT_TO_SQM = 0.09290304;

export const DEFAULT_CONSTRAINTS: Constraints = {
  prompt:
    "1500 sq ft, 3 BHK, North-facing entry, open kitchen, master suite with walk-in closet",
  plotLengthM: 18,
  plotWidthM: 12,
  setbackM: 1.5,
  targetCarpetSqm: 139.35,
  bhk: 3,
  northFacing: true,
  openKitchen: true,
  masterWalkIn: true,
};

export function parseBrief(prompt: string, base = DEFAULT_CONSTRAINTS): Constraints {
  const next = { ...base, prompt };
  const sqft = prompt.match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sf)\b/i);
  const sqm = prompt.match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*m|sqm)\b/i);
  const bhk = prompt.match(/(\d+)\s*(bhk|bed(?:room)?s?)/i);
  if (sqft) next.targetCarpetSqm = Number(sqft[1]) * SQFT_TO_SQM;
  if (sqm) next.targetCarpetSqm = Number(sqm[1]);
  if (bhk) next.bhk = Math.max(1, Math.min(5, Number(bhk[1])));
  next.northFacing = /south-facing/i.test(prompt) ? false : /north/i.test(prompt) ? true : base.northFacing;
  next.openKitchen = /closed kitchen/i.test(prompt)
    ? false
    : /open kitchen/i.test(prompt)
      ? true
      : base.openKitchen;
  next.masterWalkIn = /walk-?in/i.test(prompt) || base.masterWalkIn;
  const plot = prompt.match(/plot\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (plot) {
    next.plotWidthM = Number(plot[1]);
    next.plotLengthM = Number(plot[2]);
  }
  return next;
}

function snap(value: number, grid = 50): number {
  return Math.round(value / grid) * grid;
}

export function generateLayout(constraints: Constraints): Layout {
  const setback = snap(constraints.setbackM * 1000);
  const plotW = snap(constraints.plotWidthM * 1000);
  const plotL = snap(constraints.plotLengthM * 1000);
  const maxW = Math.max(6000, plotW - setback * 2);
  const maxD = Math.max(7000, plotL - setback * 2);

  const targetFootprint = (constraints.targetCarpetSqm * 1_000_000) / 0.86;
  let width = snap(Math.min(maxW, Math.sqrt(targetFootprint * (maxW / maxD))));
  let depth = snap(targetFootprint / width);
  if (depth > maxD) {
    depth = maxD;
    width = snap(Math.min(maxW, targetFootprint / depth));
  }
  width = Math.max(9000, width);
  depth = Math.max(11000, Math.min(maxD, depth));

  const ox = setback;
  const oy = setback;
  const bhk = constraints.bhk;
  const rooms = packRooms(ox, oy, width, depth, bhk, constraints);
  const walls = wallsFromRooms(rooms);
  const openings = placeOpenings(rooms, width, oy + depth, constraints);

  const mapped = rooms.map(packedToRoom);
  const carpet = mapped.reduce((sum, room) => sum + room.area_sqm, 0);

  return {
    metadata: {
      unit: "mm",
      scale: "1:100",
      total_area_sqm: Number(carpet.toFixed(2)),
      plot_length_mm: plotL,
      plot_width_mm: plotW,
      setback_mm: setback,
      facing: constraints.northFacing ? "north" : "south",
      brief: constraints.prompt,
    },
    rooms: mapped,
    walls,
    openings,
    details: furnish(mapped),
    views: defaultViews(),
    ink: [],
    labels: [],
  };
}

function furnish(rooms: Layout["rooms"]): Detail[] {
  const details: Detail[] = [];
  for (const room of rooms) {
    const [cx, cy] = roomCentroid(room.bounds);
    if (/Living/.test(room.name)) {
      details.push(createDetail("furniture", [[cx - 1400, cy - 700], [cx + 1400, cy + 700]]));
    } else if (/Master Suite|Bedroom/.test(room.name)) {
      const bed = createDetail("furniture", [[cx - 1000, cy - 800], [cx + 1000, cy + 800]]);
      bed.height_mm = 480;
      details.push(bed);
    } else if (/Kitchen/.test(room.name)) {
      const xs = room.bounds.map((p) => p[0]);
      const ys = room.bounds.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxY = Math.max(...ys);
      details.push(createDetail("millwork", [[minX + 200, maxY - 700], [minX + 2200, maxY - 200]]));
    } else if (/Dining/.test(room.name)) {
      details.push(createDetail("furniture", [[cx - 900, cy - 900], [cx + 900, cy + 900]]));
    }
  }
  return details;
}

function packRooms(
  ox: number,
  oy: number,
  W: number,
  D: number,
  bhk: number,
  constraints: Constraints,
): PackedRoom[] {
  const livingH = snap(Math.max(4200, D * 0.34));
  const southH = snap(Math.max(3600, D * 0.32));
  const midH = D - livingH - southH;
  const foyerW = snap(Math.max(2400, W * 0.18));
  const diningW = snap(Math.max(3200, W * 0.28));
  const livingW = W - foyerW - diningW;

  const northY = oy + D - livingH;
  const midY = oy + southH;

  const rooms: PackedRoom[] = [
    { name: "Grand Foyer", x: ox, y: northY, w: foyerW, h: livingH },
    { name: "Living Pavilion", x: ox + foyerW, y: northY, w: livingW, h: livingH },
    {
      name: constraints.openKitchen ? "Dining Gallery" : "Formal Dining",
      x: ox + foyerW + livingW,
      y: northY,
      w: diningW,
      h: livingH,
    },
  ];

  const kitchenH = snap(Math.max(2800, midH * 0.62));
  rooms.push({
    name: constraints.openKitchen ? "Open Kitchen" : "Chef's Kitchen",
    x: ox + W - diningW,
    y: northY - kitchenH,
    w: diningW,
    h: kitchenH,
  });
  rooms.push({
    name: "Utility",
    x: ox + W - diningW,
    y: midY,
    w: diningW,
    h: northY - kitchenH - midY,
  });

  const westW = snap(Math.max(3200, W * 0.34));
  const bathW = snap(1800);
  rooms.push({
    name: bhk >= 3 ? "Bedroom 02" : "Study Atelier",
    x: ox,
    y: midY,
    w: westW,
    h: midH,
  });
  rooms.push({
    name: "Powder Room",
    x: ox + westW,
    y: midY,
    w: bathW,
    h: snap(Math.min(2200, midH)),
  });
  rooms.push({
    name: "Gallery Corridor",
    x: ox + westW + bathW,
    y: midY,
    w: W - westW - bathW - diningW,
    h: midH,
  });

  if (bhk <= 1) {
    rooms.push({
      name: "Master Suite",
      x: ox,
      y: oy,
      w: W,
      h: southH,
    });
    return rooms.filter((r) => r.w > 400 && r.h > 400);
  }

  if (constraints.masterWalkIn) {
    const masterW = snap(W * 0.42);
    const ensuiteW = snap(1800);
    const wicW = snap(1600);
    const bed3W = W - masterW - ensuiteW - wicW;
    rooms.push({ name: "Bedroom 03", x: ox, y: oy, w: Math.max(2800, bed3W), h: southH });
    const xMaster = ox + Math.max(2800, bed3W);
    rooms.push({ name: "Master Suite", x: xMaster, y: oy, w: masterW, h: southH });
    rooms.push({
      name: "Walk-in Wardrobe",
      x: xMaster + masterW,
      y: oy,
      w: wicW,
      h: southH,
    });
    rooms.push({
      name: "Master Bath",
      x: xMaster + masterW + wicW,
      y: oy,
      w: ensuiteW,
      h: southH,
    });
  } else {
    const masterW = snap(W * 0.48);
    rooms.push({ name: "Bedroom 03", x: ox, y: oy, w: W - masterW, h: southH });
    rooms.push({ name: "Master Suite", x: ox + W - masterW, y: oy, w: masterW, h: southH });
  }

  if (bhk >= 4) {
    rooms.push({
      name: "Bedroom 04",
      x: ox + westW,
      y: midY + snap(Math.min(2200, midH)),
      w: bathW + snap(800),
      h: midH - snap(Math.min(2200, midH)),
    });
  }

  return rooms.filter((r) => r.w > 400 && r.h > 400);
}

function midpoint(a: Point, b: Point, width: number): { position: Point; direction: Point } {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const startAlong = (len - width) / 2;
  return {
    position: [x1 + ux * startAlong, y1 + uy * startAlong],
    direction: [ux, uy],
  };
}

function placeOpenings(
  rooms: PackedRoom[],
  _width: number,
  northY: number,
  constraints: Constraints,
): Opening[] {
  const openings: Opening[] = [];
  const foyer = rooms.find((r) => r.name === "Grand Foyer")!;
  const living = rooms.find((r) => r.name === "Living Pavilion")!;
  const entryY = constraints.northFacing ? northY : foyer.y;
  const entry: Opening = {
    type: "pivot_door",
    position: [foyer.x + foyer.w * 0.35, entryY],
    width: 1000,
    swing: "inward_90",
    direction: [1, 0],
    inward: constraints.northFacing ? [0, -1] : [0, 1],
  };
  openings.push(entry);

  openings.push({
    type: "sliding_door",
    position: [living.x + living.w * 0.28, northY],
    width: 2400,
    swing: "none",
    direction: [1, 0],
    inward: [0, -1],
  });

  const pairs: [string, string, number][] = [
    ["Grand Foyer", "Living Pavilion", 900],
    ["Living Pavilion", "Dining Gallery", 1200],
    ["Living Pavilion", "Formal Dining", 1200],
    ["Dining Gallery", "Open Kitchen", 1600],
    ["Formal Dining", "Chef's Kitchen", 900],
    ["Open Kitchen", "Utility", 800],
    ["Chef's Kitchen", "Utility", 800],
    ["Grand Foyer", "Bedroom 02", 900],
    ["Grand Foyer", "Study Atelier", 900],
    ["Gallery Corridor", "Bedroom 02", 900],
    ["Gallery Corridor", "Powder Room", 750],
    ["Gallery Corridor", "Master Suite", 900],
    ["Gallery Corridor", "Bedroom 03", 900],
    ["Master Suite", "Walk-in Wardrobe", 900],
    ["Walk-in Wardrobe", "Master Bath", 800],
    ["Master Suite", "Master Bath", 800],
    ["Living Pavilion", "Gallery Corridor", 1100],
  ];

  for (const [an, bn, width] of pairs) {
    const a = rooms.find((r) => r.name === an);
    const b = rooms.find((r) => r.name === bn);
    if (!a || !b) continue;
    const edge = sharedEdge(a, b);
    if (!edge) continue;
    const leaf = midpoint(edge.start, edge.end, width);
    openings.push({
      type: width >= 1500 ? "sliding_door" : "pivot_door",
      position: leaf.position,
      width,
      swing: width >= 1500 ? "none" : "inward_90",
      direction: leaf.direction,
      inward: edge.inward,
    });
  }

  const glazed = rooms.filter((r) =>
    /Living|Master Suite|Bedroom|Dining|Study/.test(r.name),
  );
  for (const room of glazed) {
    const onNorth = Math.abs(room.y + room.h - northY) < 4;
    const onSouth = Math.abs(room.y - rooms.reduce((m, r) => Math.min(m, r.y), Infinity)) < 4;
    const y = onNorth ? northY : onSouth ? room.y : room.y + room.h;
    if (!onNorth && !onSouth) continue;
    const width = Math.min(1800, room.w * 0.42);
    openings.push({
      type: "window",
      position: [room.x + (room.w - width) / 2, y],
      width,
      swing: "none",
      direction: [1, 0],
      inward: onNorth ? [0, -1] : [0, 1],
    });
  }

  return openings;
}
