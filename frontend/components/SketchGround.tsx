"use client";

import { Line } from "@react-three/drei";
import { useMemo, useState } from "react";
import {
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  Plane,
  Vector3,
} from "three";
import {
  mmToScene,
  originOf,
  orthoTo,
  sceneToMm,
  snapPoint,
} from "@/lib/details";
import { DETAIL_PRESETS, type Detail, type DetailKind, type Layout, type Point } from "@/lib/types";

const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const HIT = new Vector3();

function hitMm(
  event: { ray: { intersectPlane: (plane: Plane, target: Vector3) => Vector3 | null } },
  origin: { cx: number; cy: number },
  orthoFrom: Point | null,
): Point | null {
  const point = event.ray.intersectPlane(GROUND, HIT);
  if (!point) return null;
  let mm = snapPoint(sceneToMm(point.x, point.z, origin));
  if (orthoFrom) mm = orthoTo(orthoFrom, mm);
  return mm;
}

export function DetailMeshes({
  layout,
  details,
}: {
  layout: Layout;
  details: Detail[];
}) {
  const origin = useMemo(() => originOf(layout), [layout]);
  return (
    <group>
      {details.map((detail) => (
        <DetailMesh key={detail.id} detail={detail} origin={origin} />
      ))}
    </group>
  );
}

function DetailMesh({
  detail,
  origin,
}: {
  detail: Detail;
  origin: { cx: number; cy: number };
}) {
  const color = DETAIL_PRESETS[detail.kind].swatch;
  const parts = useMemo(() => solidFromDetail(detail, origin), [detail, origin]);
  return (
    <group>
      {parts.map((part, i) => (
        <mesh key={i} position={part.position} rotation={part.rotation} castShadow>
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={color}
            metalness={0.35}
            roughness={0.45}
            transparent
            opacity={0.88}
            emissive={color}
            emissiveIntensity={0.12}
          />
          <lineSegments geometry={new EdgesGeometry(new BoxGeometry(...part.size))}>
            <lineBasicMaterial color={color} />
          </lineSegments>
        </mesh>
      ))}
    </group>
  );
}

export function SketchGround({
  layout,
  kind,
  enabled,
  onCommit,
  preview,
  onPreview,
}: {
  layout: Layout;
  kind: DetailKind;
  enabled: boolean;
  onCommit: (a: Point, b: Point) => void;
  preview: [Point, Point] | null;
  onPreview: (segment: [Point, Point] | null) => void;
}) {
  const origin = useMemo(() => originOf(layout), [layout]);
  const [anchor, setAnchor] = useState<Point | null>(null);

  if (!enabled) return null;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          const mm = hitMm(event, origin, null);
          if (!mm) return;
          if (!anchor) {
            setAnchor(mm);
            onPreview([mm, mm]);
            return;
          }
          const end = hitMm(event, origin, event.shiftKey ? anchor : null) ?? mm;
          onCommit(anchor, end);
          setAnchor(end);
          onPreview([end, end]);
        }}
        onPointerMove={(event) => {
          if (!anchor) return;
          const mm = hitMm(event, origin, event.shiftKey ? anchor : null);
          if (mm) onPreview([anchor, mm]);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setAnchor(null);
          onPreview(null);
        }}
      >
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial
          transparent
          opacity={0.04}
          color="#00E5FF"
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {preview && <PreviewSegment a={preview[0]} b={preview[1]} origin={origin} kind={kind} />}
    </group>
  );
}

function PreviewSegment({
  a,
  b,
  origin,
  kind,
}: {
  a: Point;
  b: Point;
  origin: { cx: number; cy: number };
  kind: DetailKind;
}) {
  const [x1, , z1] = mmToScene(a, origin);
  const [x2, , z2] = mmToScene(b, origin);
  return (
    <Line
      points={[
        [x1, 0.08, z1],
        [x2, 0.08, z2],
      ]}
      color={DETAIL_PRESETS[kind].swatch}
      lineWidth={2}
    />
  );
}

type Solid = {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
};

export function solidFromDetail(
  detail: Detail,
  origin: { cx: number; cy: number },
): Solid[] {
  const [a, b] = [detail.path[0], detail.path[detail.path.length - 1]];
  if (!a || !b) return [];
  const [x1, , z1] = mmToScene(a, origin);
  const [x2, , z2] = mmToScene(b, origin);
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);

  if (detail.kind === "furniture" || (detail.kind === "millwork" && Math.abs(dx) > 0.2 && Math.abs(dz) > 0.2 && len > 0.5)) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    const w = Math.max(0.2, maxX - minX);
    const d = Math.max(0.2, maxZ - minZ);
    const h = detail.height_mm / 1000;
    return [
      {
        position: [(minX + maxX) / 2, h / 2, (minZ + maxZ) / 2],
        rotation: [0, 0, 0],
        size: [w, h, d],
      },
    ];
  }

  if (detail.kind === "stair") {
    const riser = 0.18;
    const steps = Math.max(4, Math.round(detail.height_mm / 1000 / riser));
    const solids: Solid[] = [];
    for (let i = 0; i < steps; i += 1) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const px = x1 + dx * (t0 + t1) / 2;
      const pz = z1 + dz * (t0 + t1) / 2;
      const h = riser * (i + 1);
      solids.push({
        position: [px, h / 2, pz],
        rotation: [0, Math.atan2(dx, dz), 0],
        size: [detail.thickness_mm / 1000, h, Math.max(0.25, len / steps)],
      });
    }
    return solids;
  }

  const h = detail.height_mm / 1000;
  const t = Math.max(0.04, detail.thickness_mm / 1000);
  const sill = detail.sill_mm / 1000;
  const angle = Math.atan2(dx, dz);
  return [
    {
      position: [(x1 + x2) / 2, sill + h / 2, (z1 + z2) / 2],
      rotation: [0, angle, 0],
      size: [t, h, Math.max(0.15, len)],
    },
  ];
}
