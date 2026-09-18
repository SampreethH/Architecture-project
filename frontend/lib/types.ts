export type Point = [number, number];

export type WallType = "exterior" | "interior";

export type OpeningType =
  | "pivot_door"
  | "sliding_door"
  | "window"
  | "casement";

export type Swing = "none" | "inward_90" | "outward_90";

export interface Room {
  name: string;
  bounds: Point[];
  area_sqm: number;
}

export interface Wall {
  start: Point;
  end: Point;
  thickness: number;
  type: WallType;
}

export interface Opening {
  type: OpeningType;
  position: Point;
  width: number;
  swing: Swing;
  direction: Point;
  inward: Point;
}

export interface LayoutMetadata {
  unit: "mm";
  scale: string;
  total_area_sqm: number;
  plot_length_mm: number;
  plot_width_mm: number;
  setback_mm: number;
  facing: string;
  brief: string;
}

export interface Detail {
  id: string;
  kind: DetailKind;
  path: Point[];
  height_mm: number;
  thickness_mm: number;
  sill_mm: number;
}

export type DetailKind =
  | "partition"
  | "millwork"
  | "glazing"
  | "furniture"
  | "stair";

export const DETAIL_PRESETS: Record<
  DetailKind,
  { label: string; height_mm: number; thickness_mm: number; sill_mm: number; swatch: string }
> = {
  partition: { label: "Partition", height_mm: 2700, thickness_mm: 100, sill_mm: 0, swatch: "#C8CCD3" },
  millwork: { label: "Millwork", height_mm: 900, thickness_mm: 600, sill_mm: 0, swatch: "#C5A880" },
  glazing: { label: "Glazing", height_mm: 1500, thickness_mm: 50, sill_mm: 900, swatch: "#00E5FF" },
  furniture: { label: "Furniture", height_mm: 750, thickness_mm: 0, sill_mm: 0, swatch: "#D4AF37" },
  stair: { label: "Stair", height_mm: 3000, thickness_mm: 1100, sill_mm: 0, swatch: "#FF4B4B" },
};

export type Approval = "draft" | "submitted" | "approved" | "baked";

export interface InkStroke {
  id: string;
  points: Point[];
  viewId: string;
  color: string;
}

export interface HandLabel {
  id: string;
  viewId: string;
  position: Point;
  text: string;
  handwritten: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  approval: Approval;
  stamps: string[];
}

export interface Layout {
  metadata: LayoutMetadata;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  details: Detail[];
  views: SavedView[];
  ink: InkStroke[];
  labels: HandLabel[];
}

export interface Constraints {
  prompt: string;
  plotLengthM: number;
  plotWidthM: number;
  setbackM: number;
  targetCarpetSqm: number;
  bhk: number;
  northFacing: boolean;
  openKitchen: boolean;
  masterWalkIn: boolean;
}

export type CadLayerId =
  | "A-WALL-EXTR"
  | "A-WALL-INTR"
  | "A-DOOR"
  | "A-GLAZ"
  | "A-ANNO-TEXT"
  | "A-ANNO-DIMS";

export const CAD_LAYERS: {
  id: CadLayerId;
  label: string;
  swatch: string;
}[] = [
  { id: "A-WALL-EXTR", label: "Exterior walls", swatch: "#F4F1EA" },
  { id: "A-WALL-INTR", label: "Interior walls", swatch: "#8E9299" },
  { id: "A-DOOR", label: "Doors & swings", swatch: "#FF4B4B" },
  { id: "A-GLAZ", label: "Glazing", swatch: "#00E5FF" },
  { id: "A-ANNO-TEXT", label: "Room annotation", swatch: "#D4AF37" },
  { id: "A-ANNO-DIMS", label: "Dimensions", swatch: "#7CFF9B" },
];
