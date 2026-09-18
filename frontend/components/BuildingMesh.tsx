"use client";

import { useMemo } from "react";
import { MathUtils } from "three";
import { MATERIAL_LOOK, buildHouseSolids } from "@/lib/massing";
import type { Layout } from "@/lib/types";

export default function BuildingMesh({
  layout,
  morph,
  cutaway = false,
}: {
  layout: Layout;
  morph: number;
  cutaway?: boolean;
}) {
  const solids = useMemo(() => buildHouseSolids(layout), [layout]);
  const flatten = MathUtils.lerp(1, 0.035, morph);

  return (
    <group>
      {solids.map((solid, index) => {
        const look = MATERIAL_LOOK[solid.material];
        const isRoof = solid.name === "Roof" || solid.name === "Parapet";
        const isSite = solid.name === "Site";
        if (cutaway && (isRoof || isSite)) return null;
        const h = isRoof ? solid.h * Math.max(0.15, 1 - morph) : solid.h * flatten;
        if (h < 0.02) return null;
        return (
          <mesh
            key={`${solid.name}-${index}`}
            position={[solid.x, solid.y * flatten + (isRoof ? (h - solid.h * flatten) / 2 : 0), solid.z]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[solid.w, Math.max(0.025, h), solid.d]} />
            <meshPhysicalMaterial
              color={look.color}
              roughness={look.roughness}
              metalness={look.metalness}
              opacity={look.opacity}
              transparent={look.opacity < 1}
              transmission={look.transmission}
              thickness={look.transmission ? 0.25 : 0}
              envMapIntensity={1.1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
