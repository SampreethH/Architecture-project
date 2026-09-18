import { packedToRoom, wallsFromRooms, type PackedRoom } from "./geometry";
import type { Constraints, Layout, Opening } from "./types";

function grayscale(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0; i < out.length; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return out;
}

function otsu(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v] += 1;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

function flood(
  binary: Uint8Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
  from: number,
  to: number,
): number {
  if (binary[sy * w + sx] !== from) return 0;
  const stack = [sy * w + sx];
  let count = 0;
  while (stack.length) {
    const idx = stack.pop()!;
    if (binary[idx] !== from) continue;
    binary[idx] = to;
    count += 1;
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x + 1 < w) stack.push(idx + 1);
    if (y > 0) stack.push(idx - w);
    if (y + 1 < h) stack.push(idx + w);
  }
  return count;
}

export async function vectorizeSketch(
  file: File,
  constraints: Constraints,
): Promise<Layout> {
  const bitmap = await createImageBitmap(file);
  const max = 420;
  const scale = Math.min(max / bitmap.width, max / bitmap.height);
  const w = Math.max(40, Math.round(bitmap.width * scale));
  const h = Math.max(40, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const gray = grayscale(pixels);
  const t = otsu(gray);
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i += 1) binary[i] = gray[i] < t ? 1 : 0;

  flood(binary, w, h, 0, 0, 0, 2);

  const regions: PackedRoom[] = [];
  let label = 10;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (binary[y * w + x] !== 0) continue;
      const size = flood(binary, w, h, x, y, 0, label);
      if (size < 80) {
        label += 1;
        continue;
      }
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      for (let i = 0; i < binary.length; i += 1) {
        if (binary[i] !== label) continue;
        const px = i % w;
        const py = (i / w) | 0;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
      regions.push({
        name: `Room ${regions.length + 1}`,
        x: minX,
        y: minY,
        w: Math.max(2, maxX - minX),
        h: Math.max(2, maxY - minY),
      });
      label += 1;
    }
  }

  const setback = constraints.setbackM * 1000;
  const plotW = constraints.plotWidthM * 1000 - setback * 2;
  const plotL = constraints.plotLengthM * 1000 - setback * 2;
  const names = [
    "Grand Foyer",
    "Living Pavilion",
    "Open Kitchen",
    "Master Suite",
    "Walk-in Wardrobe",
    "Bedroom 02",
    "Bedroom 03",
    "Powder Room",
    "Utility",
  ];

  const packed = (regions.length ? regions : fallbackRooms()).map((room, i) => ({
    name: names[i] ?? `Chamber ${i + 1}`,
    x: Math.round(setback + (room.x / w) * plotW),
    y: Math.round(setback + ((h - room.y - room.h) / h) * plotL),
    w: Math.max(1800, Math.round((room.w / w) * plotW)),
    h: Math.max(1800, Math.round((room.h / h) * plotL)),
  }));

  const rooms = packed.map(packedToRoom);
  const walls = wallsFromRooms(packed);
  const openings: Opening[] = [
    {
      type: "pivot_door",
      position: [packed[0].x + packed[0].w * 0.4, packed.reduce((m, r) => Math.max(m, r.y + r.h), 0)],
      width: 1000,
      swing: "inward_90",
      direction: [1, 0],
      inward: [0, -1],
    },
  ];

  const carpet = rooms.reduce((s, r) => s + r.area_sqm, 0);
  return {
    metadata: {
      unit: "mm",
      scale: "1:100",
      total_area_sqm: Number(carpet.toFixed(2)),
      plot_length_mm: constraints.plotLengthM * 1000,
      plot_width_mm: constraints.plotWidthM * 1000,
      setback_mm: setback,
      facing: constraints.northFacing ? "north" : "south",
      brief: `Vectorized from ${file.name}`,
    },
    rooms,
    walls,
    openings,
    details: [],
    views: [],
    ink: [],
    labels: [],
  };
}

function fallbackRooms(): PackedRoom[] {
  return [
    { name: "A", x: 10, y: 10, w: 80, h: 50 },
    { name: "B", x: 90, y: 10, w: 120, h: 50 },
    { name: "C", x: 10, y: 60, w: 200, h: 70 },
  ];
}
