import { mmToScene, originOf } from "./details";
import { roomCentroid } from "./geometry";
import type { Layout, Room } from "./types";

export type TourStop = {
  id: string;
  title: string;
  caption: string;
  eye: [number, number, number];
  look: [number, number, number];
};

const SKIP = /corridor|utility|powder|wardrobe|bath/i;

const CAPTION: Record<string, string> = {
  foyer: "After completion — arrival hall with warm wood and a console.",
  living: "After completion — living room dressed for evening, sofa facing the garden glass.",
  dining: "After completion — dining gallery set for a family meal.",
  kitchen: "After completion — kitchen with counters, island, and under-cabinet light.",
  bedroom: "After completion — bedroom with a made bed and quiet side lamps.",
  master: "After completion — master suite, dressed and ready to live in.",
  study: "After completion — a study with a desk looking toward the window.",
  default: "After completion — this room furnished as it would be on handover.",
};

export function friendlyRoomName(name: string) {
  return name
    .replace("Pavilion", "room")
    .replace("Gallery", "")
    .replace("Grand ", "")
    .replace("Open ", "")
    .replace("Chef's ", "")
    .trim();
}

function kindOf(name: string) {
  if (/foyer/i.test(name)) return "foyer";
  if (/living/i.test(name)) return "living";
  if (/dining/i.test(name)) return "dining";
  if (/kitchen/i.test(name)) return "kitchen";
  if (/master/i.test(name)) return "master";
  if (/bed/i.test(name)) return "bedroom";
  if (/study|atelier/i.test(name)) return "study";
  return "default";
}

export function buildTourStops(layout: Layout): TourStop[] {
  const origin = originOf(layout);
  const rooms = layout.rooms.filter((room) => !SKIP.test(room.name) && room.area_sqm > 6);
  const order = ["foyer", "living", "dining", "kitchen", "study", "master", "bedroom", "default"];
  const ranked = [...rooms].sort((a, b) => order.indexOf(kindOf(a.name)) - order.indexOf(kindOf(b.name)));

  return ranked.map((room) => {
    const kind = kindOf(room.name);
    const xs = room.bounds.map((p) => p[0]);
    const ys = room.bounds.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const [cx, cy] = roomCentroid(room.bounds);
    const eyeMm: [number, number] = [
      minX + (maxX - minX) * 0.28,
      minY + (maxY - minY) * 0.22,
    ];
    const [ex, , ez] = mmToScene(eyeMm, origin);
    const [lx, , lz] = mmToScene([cx, cy], origin);
    return {
      id: room.name,
      title: friendlyRoomName(room.name),
      caption: CAPTION[kind] ?? CAPTION.default,
      eye: [ex, 1.58, ez],
      look: [lx, 1.15, lz],
    };
  });
}

export function roomKind(room: Room) {
  return kindOf(room.name);
}
