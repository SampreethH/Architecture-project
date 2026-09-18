import type {
  Approval,
  Detail,
  HandLabel,
  InkStroke,
  Layout,
  Point,
  SavedView,
} from "./types";
import { createDetail } from "./details";

export type AtelierTool =
  | "orbit"
  | "ink"
  | "label"
  | "partition"
  | "millwork"
  | "glazing"
  | "furniture"
  | "stair";

export const TOOL_LABELS: Record<AtelierTool, string> = {
  orbit: "Look around",
  ink: "Draw",
  label: "Write a note",
  partition: "Wall",
  millwork: "Cabinet",
  glazing: "Window",
  furniture: "Furniture",
  stair: "Stairs",
};

export function defaultViews(): SavedView[] {
  return [
    {
      id: "view-1",
      name: "View 1 · Iso",
      position: [11, 7.5, 12],
      target: [0, 1.2, 0],
      approval: "draft",
      stamps: [],
    },
    {
      id: "view-2",
      name: "View 2 · Elevation",
      position: [0, 2.2, 16],
      target: [0, 1.4, 0],
      approval: "draft",
      stamps: [],
    },
    {
      id: "view-3",
      name: "View 3 · Plan",
      position: [0, 22, 0.05],
      target: [0, 0, 0],
      approval: "draft",
      stamps: [],
    },
  ];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function newStroke(viewId: string, points: Point[]): InkStroke {
  return { id: uid("ink"), viewId, points, color: "#E8D5A3" };
}

export function newLabel(viewId: string, position: Point, text: string): HandLabel {
  return { id: uid("lbl"), viewId, position, text, handwritten: true };
}

export function nextApproval(current: Approval): Approval {
  if (current === "draft") return "submitted";
  if (current === "submitted") return "approved";
  if (current === "approved") return "baked";
  return "baked";
}

export function bakeViewTo3d(
  layout: Layout,
  view: SavedView,
  strokes: InkStroke[],
  labels: HandLabel[],
): Detail[] {
  const xs = layout.rooms.flatMap((r) => r.bounds.map((p) => p[0]));
  const ys = layout.rooms.flatMap((r) => r.bounds.map((p) => p[1]));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);

  const toMm = (uv: Point): Point => [
    minX + (uv[0] / 1000) * w,
    minY + (1 - uv[1] / 1000) * h,
  ];

  const details: Detail[] = [];
  for (const stroke of strokes.filter((s) => s.viewId === view.id)) {
    if (stroke.points.length < 2) continue;
    const a = toMm(stroke.points[0]);
    const b = toMm(stroke.points[stroke.points.length - 1]);
    details.push(createDetail("partition", [a, b]));
  }
  for (const label of labels.filter((l) => l.viewId === view.id)) {
    const p = toMm(label.position);
    const tag = createDetail("millwork", [p, [p[0] + 900, p[1] + 400]]);
    tag.height_mm = 150;
    details.push(tag);
  }
  return details;
}

export const PREMIUM_GATES = [
  "View-locked ink (iso / elevation / plan each keep their own sketch)",
  "Handwritten labels that bake to a separate 3D layer",
  "2D approval stamp before 3D conversion",
  "SketchUp Scenes = saved views, ZWCAD DWG/DXF in the same pack",
  "No Revit/BIM tax — massing to Enscape without a PM suite",
];
