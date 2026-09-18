import type { Opening, Point, Room, Wall } from "./types";

export function polygonAreaSqm(bounds: Point[]): number {
  let acc = 0;
  for (let i = 0; i < bounds.length; i += 1) {
    const [x1, y1] = bounds[i];
    const [x2, y2] = bounds[(i + 1) % bounds.length];
    acc += x1 * y2 - x2 * y1;
  }
  return Math.abs(acc) / 2 / 1_000_000;
}

export function polygonPerimeterMm(bounds: Point[]): number {
  let acc = 0;
  for (let i = 0; i < bounds.length; i += 1) {
    const [x1, y1] = bounds[i];
    const [x2, y2] = bounds[(i + 1) % bounds.length];
    acc += Math.hypot(x2 - x1, y2 - y1);
  }
  return acc;
}

export function roomCentroid(bounds: Point[]): Point {
  const n = bounds.length || 1;
  const sx = bounds.reduce((a, p) => a + p[0], 0) / n;
  const sy = bounds.reduce((a, p) => a + p[1], 0) / n;
  return [sx, sy];
}

export function rectBounds(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

export interface PackedRoom {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function packedToRoom(room: PackedRoom): Room {
  const bounds = rectBounds(room.x, room.y, room.w, room.h);
  return {
    name: room.name,
    bounds,
    area_sqm: polygonAreaSqm(bounds),
  };
}

function edgeKey(a: Point, b: Point): string {
  const [p, q] =
    a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${p[0]},${p[1]}|${q[0]},${q[1]}`;
}

function overlap1d(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  if (hi - lo < 80) return null;
  return [lo, hi];
}

export function wallsFromRooms(rooms: PackedRoom[]): Wall[] {
  const EXTERIOR = 230;
  const INTERIOR = 150;
  const occupancy = new Map<string, number>();
  const segments: { start: Point; end: Point }[] = [];

  const push = (start: Point, end: Point) => {
    const key = edgeKey(start, end);
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
    if (!segments.some((s) => edgeKey(s.start, s.end) === key)) {
      segments.push({ start, end });
    }
  };

  for (const room of rooms) {
    push([room.x, room.y], [room.x + room.w, room.y]);
    push([room.x + room.w, room.y], [room.x + room.w, room.y + room.h]);
    push([room.x + room.w, room.y + room.h], [room.x, room.y + room.h]);
    push([room.x, room.y + room.h], [room.x, room.y]);
  }

  const merged: Wall[] = [];
  for (const seg of segments) {
    const count = occupancy.get(edgeKey(seg.start, seg.end)) ?? 1;
    merged.push({
      start: seg.start,
      end: seg.end,
      thickness: count > 1 ? INTERIOR : EXTERIOR,
      type: count > 1 ? "interior" : "exterior",
    });
  }
  return mergeCollinear(merged);
}

function mergeCollinear(walls: Wall[]): Wall[] {
  const groups = new Map<string, Wall[]>();
  for (const wall of walls) {
    const horizontal = wall.start[1] === wall.end[1];
    const axis = horizontal ? `h:${wall.start[1]}:${wall.type}` : `v:${wall.start[0]}:${wall.type}`;
    const list = groups.get(axis) ?? [];
    list.push(wall);
    groups.set(axis, list);
  }

  const out: Wall[] = [];
  for (const [, group] of groups) {
    const horizontal = group[0].start[1] === group[0].end[1];
    const intervals = group
      .map((w) => {
        const a = horizontal ? w.start[0] : w.start[1];
        const b = horizontal ? w.end[0] : w.end[1];
        return { lo: Math.min(a, b), hi: Math.max(a, b), wall: w };
      })
      .sort((a, b) => a.lo - b.lo);

    let cur = intervals[0];
    for (let i = 1; i < intervals.length; i += 1) {
      const nxt = intervals[i];
      if (nxt.lo <= cur.hi + 1) {
        cur = { ...cur, hi: Math.max(cur.hi, nxt.hi) };
      } else {
        out.push(intervalToWall(cur, horizontal));
        cur = nxt;
      }
    }
    out.push(intervalToWall(cur, horizontal));
  }
  return out;
}

function intervalToWall(
  cur: { lo: number; hi: number; wall: Wall },
  horizontal: boolean,
): Wall {
  const { wall } = cur;
  if (horizontal) {
    const y = wall.start[1];
    return { ...wall, start: [cur.lo, y], end: [cur.hi, y] };
  }
  const x = wall.start[0];
  return { ...wall, start: [x, cur.lo], end: [x, cur.hi] };
}

export function sharedEdge(
  a: PackedRoom,
  b: PackedRoom,
): { start: Point; end: Point; inward: Point; direction: Point } | null {
  if (Math.abs(a.x + a.w - b.x) < 2 || Math.abs(b.x + b.w - a.x) < 2) {
    const x = Math.abs(a.x + a.w - b.x) < 2 ? a.x + a.w : b.x + b.w;
    const ov = overlap1d(a.y, a.y + a.h, b.y, b.y + b.h);
    if (!ov) return null;
    const inward: Point = a.x + a.w <= b.x + 2 ? [1, 0] : [-1, 0];
    return { start: [x, ov[0]], end: [x, ov[1]], inward, direction: [0, 1] };
  }
  if (Math.abs(a.y + a.h - b.y) < 2 || Math.abs(b.y + b.h - a.y) < 2) {
    const y = Math.abs(a.y + a.h - b.y) < 2 ? a.y + a.h : b.y + b.h;
    const ov = overlap1d(a.x, a.x + a.w, b.x, b.x + b.w);
    if (!ov) return null;
    const inward: Point = a.y + a.h <= b.y + 2 ? [0, 1] : [0, -1];
    return { start: [ov[0], y], end: [ov[1], y], inward, direction: [1, 0] };
  }
  return null;
}

export function layoutExtents(rooms: Room[], walls: Wall[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const pts: Point[] = [
    ...rooms.flatMap((r) => r.bounds),
    ...walls.flatMap((w) => [w.start, w.end]),
  ];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

export function openingLeaf(opening: Opening): Point {
  const [dx, dy] = opening.direction;
  const len = Math.hypot(dx, dy) || 1;
  return [
    opening.position[0] + (dx / len) * opening.width,
    opening.position[1] + (dy / len) * opening.width,
  ];
}
