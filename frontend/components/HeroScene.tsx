"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useRef } from "react";
import { Group, MathUtils, MOUSE, Vector3 } from "three";
import BuildingMesh from "@/components/BuildingMesh";
import FinishedInteriors from "@/components/FinishedInteriors";
import { DetailMeshes, SketchGround } from "@/components/SketchGround";
import { layoutExtents } from "@/lib/geometry";
import { heroPointer } from "@/lib/heroPointer";
import type { TourStop } from "@/lib/homeTour";
import type { Detail, DetailKind, Layout, Point, SavedView } from "@/lib/types";

function PavilionRig({
  layout,
  morph,
  locked,
  followPointer,
  tourMode,
}: {
  layout: Layout;
  morph: number;
  locked: boolean;
  followPointer: boolean;
  tourMode: boolean;
}) {
  const group = useRef<Group>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const extents = layoutExtents(layout.rooms, layout.walls);
  const sx = (extents.maxX - extents.minX) / 1000;
  const sz = (extents.maxY - extents.minY) / 1000;

  useFrame((state, delta) => {
    if (!group.current) return;
    if (tourMode) {
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, 0, 3.2, delta);
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, 0, 3.2, delta);
      return;
    }
    if (locked) {
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, 0.22, 2.2, delta);
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, -0.18, 2.2, delta);
      return;
    }
    if (followPointer) {
      target.current.x = heroPointer.x * 0.55;
      target.current.y = heroPointer.y * 0.28;
      velocity.current.x = MathUtils.damp(velocity.current.x, target.current.x, 2.4, delta);
      velocity.current.y = MathUtils.damp(velocity.current.y, target.current.y, 2.4, delta);
      group.current.rotation.y =
        velocity.current.x + state.clock.elapsedTime * 0.04 * (1 - morph);
      group.current.rotation.x =
        MathUtils.lerp(-0.18, -Math.PI / 2 + 0.02, morph) + velocity.current.y * (1 - morph);
      return;
    }
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, 0.18, 1.6, delta);
    group.current.rotation.x = MathUtils.damp(
      group.current.rotation.x,
      MathUtils.lerp(-0.18, -Math.PI / 2 + 0.02, morph),
      1.6,
      delta,
    );
  });

  return (
    <group ref={group} scale={tourMode ? 1 : 0.72}>
      {tourMode ? null : (
        <gridHelper
          args={[Math.max(sx, sz) + 10, 32, "#3A3428", "#16181F"]}
          position={[0, 0.02, 0]}
        />
      )}
      <BuildingMesh layout={layout} morph={tourMode ? 0 : morph} cutaway={tourMode} />
      {tourMode ? <FinishedInteriors layout={layout} /> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[sx + 14, sz + 14]} />
        <meshStandardMaterial color="#14120F" roughness={0.92} metalness={0.08} />
      </mesh>
    </group>
  );
}

function ViewCamera({ view }: { view?: SavedView }) {
  const { camera } = useThree();
  const look = useRef(new Vector3());
  useEffect(() => {
    if (!view) return;
    camera.position.set(...view.position);
    camera.lookAt(...view.target);
  }, [camera, view]);
  useFrame(() => {
    if (!view) return;
    camera.position.lerp(new Vector3(...view.position), 0.08);
    look.current.lerp(new Vector3(...view.target), 0.08);
    camera.lookAt(look.current);
  });
  return null;
}

function TourCamera({ stop }: { stop?: TourStop }) {
  const { camera } = useThree();
  const look = useRef(new Vector3());
  useEffect(() => {
    if (!stop) return;
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }, [camera, stop]);
  useFrame((_, delta) => {
    if (!stop) return;
    camera.position.lerp(new Vector3(...stop.eye), 1 - Math.exp(-2.1 * delta));
    look.current.lerp(new Vector3(...stop.look), 1 - Math.exp(-2.1 * delta));
    camera.lookAt(look.current);
  });
  return stop ? <pointLight position={stop.eye} intensity={1.6} color="#F6E7C1" distance={9} /> : null;
}

export default function HeroScene({
  layout,
  morph,
  sketching = false,
  sketchKind = "partition",
  details = [],
  preview = null,
  activeView,
  onCommitSketch,
  onPreview,
  orbitEnabled = false,
  heroMode = false,
  tourMode = false,
  tourStop,
}: {
  layout: Layout;
  morph: number;
  sketching?: boolean;
  sketchKind?: DetailKind;
  details?: Detail[];
  preview?: [Point, Point] | null;
  activeView?: SavedView;
  onCommitSketch?: (a: Point, b: Point) => void;
  onPreview?: (segment: [Point, Point] | null) => void;
  orbitEnabled?: boolean;
  heroMode?: boolean;
  tourMode?: boolean;
  tourStop?: TourStop;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [18, 10.5, 20], fov: 32, near: 0.08, far: 90 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={[tourMode ? "#1A140F" : "#0A0B0E"]} />
      <fog attach="fog" args={[tourMode ? "#1A140F" : "#0A0B0E", tourMode ? 12 : 22, tourMode ? 28 : 48]} />
      <hemisphereLight args={["#F2E4C4", "#1A2228", tourMode ? 0.75 : 0.55]} />
      <ambientLight intensity={tourMode ? 0.42 : 0.22} />
      <directionalLight
        position={[9, 14, 6]}
        intensity={tourMode ? 0.9 : 1.85}
        color="#F6E7C1"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.45} color="#7FB8C9" />
      <pointLight position={[4, 3, 5]} intensity={0.9} color="#D4AF37" distance={18} />
      {tourMode ? <TourCamera stop={tourStop} /> : null}
      {!heroMode && !orbitEnabled && !tourMode ? <ViewCamera view={activeView} /> : null}
      <PavilionRig
        layout={layout}
        morph={morph}
        locked={sketching}
        followPointer={heroMode}
        tourMode={tourMode}
      />
      {tourMode ? null : <DetailMeshes layout={layout} details={details} />}
      <SketchGround
        layout={layout}
        kind={sketchKind}
        enabled={sketching && !tourMode}
        preview={preview}
        onPreview={onPreview ?? (() => undefined)}
        onCommit={onCommitSketch ?? (() => undefined)}
      />
      {tourMode ? null : <ContactShadows opacity={0.45} scale={28} blur={2.4} far={12} />}
      <OrbitControls
        enabled={!heroMode && !tourMode && (orbitEnabled || sketching)}
        enablePan={orbitEnabled}
        enableZoom={sketching || orbitEnabled}
        enableRotate={orbitEnabled}
        mouseButtons={{
          LEFT: sketching ? (-1 as unknown as typeof MOUSE.ROTATE) : MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.ROTATE,
        }}
        maxPolarAngle={Math.PI / 2.05}
      />
      <EffectComposer>
        <Bloom intensity={tourMode ? 0.35 : 0.55 - morph * 0.35} luminanceThreshold={0.22} mipmapBlur />
        <Vignette eskil={false} offset={0.28} darkness={tourMode ? 0.62 : 0.5} />
      </EffectComposer>
    </Canvas>
  );
}
