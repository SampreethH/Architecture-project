import { layoutExtents } from "./geometry";
import { DETAIL_PRESETS, type Detail, type DetailKind, type Layout, type Point } from "./types";

export function originOf(layout: Layout) {
  const e = layoutExtents(layout.rooms, layout.walls);
  return {
    cx: (e.minX + e.maxX) / 2,
    cy: (e.minY + e.maxY) / 2,
  };
}

export function sceneToMm(
  x: number,
  z: number,
  origin: { cx: number; cy: number },
): Point {
  return [Math.round(x * 1000 + origin.cx), Math.round(-z * 1000 + origin.cy)];
}

export function mmToScene(
  point: Point,
  origin: { cx: number; cy: number },
): [number, number, number] {
  return [(point[0] - origin.cx) / 1000, 0, -(point[1] - origin.cy) / 1000];
}

export function snapMm(value: number, grid = 100): number {
  return Math.round(value / grid) * grid;
}

export function snapPoint(point: Point, grid = 100): Point {
  return [snapMm(point[0], grid), snapMm(point[1], grid)];
}

export function orthoTo(from: Point, to: Point): Point {
  const dx = Math.abs(to[0] - from[0]);
  const dy = Math.abs(to[1] - from[1]);
  return dx >= dy ? [to[0], from[1]] : [from[0], to[1]];
}

export function createDetail(kind: DetailKind, path: Point[]): Detail {
  const preset = DETAIL_PRESETS[kind];
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `detail-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    path: path.map((p) => snapPoint(p)),
    height_mm: preset.height_mm,
    thickness_mm: preset.thickness_mm,
    sill_mm: preset.sill_mm,
  };
}

export function orthogonalizeStroke(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const start = snapPoint(points[0]);
  const end = snapPoint(points[points.length - 1]);
  const locked = orthoTo(start, end);
  const spanX = Math.abs(end[0] - start[0]);
  const spanY = Math.abs(end[1] - start[1]);
  const closed =
    Math.hypot(end[0] - start[0], end[1] - start[1]) < 400 && points.length > 8;
  if (closed) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [
      [snapMm(Math.min(...xs)), snapMm(Math.min(...ys))],
      [snapMm(Math.max(...xs)), snapMm(Math.max(...ys))],
    ];
  }
  if (spanX > 350 && spanY > 350) {
    return [start, end];
  }
  return [start, locked];
}

export function inferKind(path: Point[], walls: Layout["walls"]): DetailKind {
  if (path.length >= 2) {
    const [a, b] = [path[0], path[path.length - 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const isRect =
      path.length === 2 &&
      Math.abs(b[0] - a[0]) > 400 &&
      Math.abs(b[1] - a[1]) > 400;
    if (isRect) {
      const area = (Math.abs(b[0] - a[0]) * Math.abs(b[1] - a[1])) / 1e6;
      return area > 2.5 ? "furniture" : "millwork";
    }
    if (len > 2800 && len < 5200) return "stair";
    const nearWall = walls.some((wall) => {
      const d1 = distToSeg(a, wall.start, wall.end);
      const d2 = distToSeg(b, wall.start, wall.end);
      return Math.min(d1, d2) < 280;
    });
    if (nearWall && len >= 900 && len <= 2400) return "glazing";
    if (len < 1800) return "millwork";
  }
  return "partition";
}

function distToSeg(p: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

export function generateDetailsFromStrokes(
  strokes: Point[][],
  walls: Layout["walls"],
): Detail[] {
  return strokes
    .map(orthogonalizeStroke)
    .filter((path) => path.length >= 2)
    .map((path) => createDetail(inferKind(path, walls), path));
}
