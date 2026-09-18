"use client";

import { useMemo } from "react";
import { mmToScene, originOf } from "@/lib/details";
import { roomKind } from "@/lib/homeTour";
import type { Layout, Room } from "@/lib/types";

function Box({
  position,
  size,
  color,
  roughness = 0.48,
  metalness = 0.08,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

export default function FinishedInteriors({ layout }: { layout: Layout }) {
  const origin = useMemo(() => originOf(layout), [layout]);
  return (
    <group>
      {layout.rooms.map((room) => (
        <RoomSet key={room.name} room={room} origin={origin} />
      ))}
    </group>
  );
}

function RoomSet({
  room,
  origin,
}: {
  room: Room;
  origin: { cx: number; cy: number };
}) {
  const xs = room.bounds.map((p) => p[0]);
  const ys = room.bounds.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const at = (mx: number, my: number, y: number): [number, number, number] => {
    const [x, , z] = mmToScene([mx, my], origin);
    return [x, y, z];
  };
  const kind = roomKind(room);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return (
    <group>
      <mesh position={at(cx, cy, 0.015)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[(maxX - minX) / 1000 - 0.2, (maxY - minY) / 1000 - 0.2]} />
        <meshStandardMaterial
          color={kind === "kitchen" || kind === "default" ? "#C4B8A8" : "#6E4B32"}
          roughness={0.7}
        />
      </mesh>
      {kind === "living" ? <Living cx={cx} cy={cy} at={at} /> : null}
      {kind === "dining" ? <Dining cx={cx} cy={cy} at={at} /> : null}
      {kind === "kitchen" ? <Kitchen minX={minX} maxX={maxX} minY={minY} maxY={maxY} at={at} /> : null}
      {kind === "bedroom" || kind === "master" ? <Bedroom cx={cx} cy={cy} at={at} luxe={kind === "master"} /> : null}
      {kind === "foyer" ? <Foyer cx={cx} cy={cy} at={at} /> : null}
      {kind === "study" ? <Study cx={cx} cy={cy} at={at} /> : null}
    </group>
  );
}

function Living({
  cx,
  cy,
  at,
}: {
  cx: number;
  cy: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
}) {
  return (
    <group>
      <Box position={at(cx, cy, 0.03)} size={[2.6, 0.04, 1.8]} color="#8A3A32" roughness={0.7} />
      <Box position={at(cx, cy - 900, 0.42)} size={[2.4, 0.72, 0.85]} color="#4A4038" />
      <Box position={at(cx, cy - 900, 0.86)} size={[2.4, 0.18, 0.28]} color="#C4B09A" />
      <Box position={at(cx, cy, 0.28)} size={[1.1, 0.32, 0.6]} color="#D8C3A5" />
      <Box position={at(cx + 1100, cy + 200, 0.38)} size={[0.7, 0.72, 0.7]} color="#5C534A" />
      <Box position={at(cx, cy + 1100, 0.35)} size={[2.1, 0.5, 0.28]} color="#2A2420" metalness={0.4} />
      <Box position={at(cx - 1200, cy - 400, 0.75)} size={[0.12, 1.5, 0.12]} color="#C5A880" metalness={0.6} />
      <mesh position={at(cx - 1200, cy - 400, 1.55)}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#F6E7C1" emissive="#F6E7C1" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function Dining({
  cx,
  cy,
  at,
}: {
  cx: number;
  cy: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
}) {
  return (
    <group>
      <Box position={at(cx, cy, 0.76)} size={[1.8, 0.08, 0.9]} color="#5A3A22" />
      <Box position={at(cx, cy, 0.38)} size={[0.12, 0.72, 0.12]} color="#C5A880" metalness={0.45} />
      {([-700, 700] as const).map((dx) =>
        ([-350, 350] as const).map((dy) => (
          <Box
            key={`${dx}-${dy}`}
            position={at(cx + dx, cy + dy, 0.46)}
            size={[0.42, 0.88, 0.42]}
            color="#3E3832"
          />
        )),
      )}
    </group>
  );
}

function Kitchen({
  minX,
  maxX,
  minY,
  maxY,
  at,
}: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
}) {
  const backY = maxY - 350;
  const midX = (minX + maxX) / 2;
  return (
    <group>
      <Box position={at(midX, backY, 0.45)} size={[Math.min(3.4, (maxX - minX) / 1000 - 0.5), 0.9, 0.62]} color="#E8DCC8" />
      <Box position={at(midX, backY, 0.92)} size={[Math.min(3.4, (maxX - minX) / 1000 - 0.5), 0.04, 0.64]} color="#D9D3CC" metalness={0.35} />
      <Box position={at(midX, backY, 1.85)} size={[Math.min(3.0, (maxX - minX) / 1000 - 0.8), 0.55, 0.34]} color="#E8DCC8" />
      <Box position={at(midX, (minY + maxY) / 2, 0.45)} size={[1.6, 0.9, 0.7]} color="#4A4038" />
      <Box position={at(midX, (minY + maxY) / 2, 0.92)} size={[1.64, 0.04, 0.74]} color="#EFEAE2" />
    </group>
  );
}

function Bedroom({
  cx,
  cy,
  at,
  luxe,
}: {
  cx: number;
  cy: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
  luxe: boolean;
}) {
  return (
    <group>
      <Box position={at(cx, cy + 200, 0.18)} size={[luxe ? 2.1 : 1.8, 0.28, luxe ? 2.1 : 1.9]} color="#2C2622" />
      <Box position={at(cx, cy + 200, 0.42)} size={[luxe ? 2.0 : 1.7, 0.22, luxe ? 2.0 : 1.8]} color="#E8D5C4" />
      <Box position={at(cx - 400, cy + 900, 0.58)} size={[0.45, 0.18, 0.28]} color="#F4EFE8" />
      <Box position={at(cx + 400, cy + 900, 0.58)} size={[0.45, 0.18, 0.28]} color="#F4EFE8" />
      <Box position={at(cx, cy + 1050, 0.7)} size={[luxe ? 2.1 : 1.8, 0.9, 0.12]} color="#3A322C" />
      <Box position={at(cx - 1200, cy + 200, 0.35)} size={[0.45, 0.5, 0.45]} color="#C5A880" />
      <Box position={at(cx + 1200, cy + 200, 0.35)} size={[0.45, 0.5, 0.45]} color="#C5A880" />
    </group>
  );
}

function Foyer({
  cx,
  cy,
  at,
}: {
  cx: number;
  cy: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
}) {
  return (
    <group>
      <Box position={at(cx, cy, 0.7)} size={[1.1, 0.12, 0.38]} color="#5A3A22" />
      <Box position={at(cx, cy, 0.35)} size={[0.08, 0.7, 0.08]} color="#C5A880" metalness={0.5} />
      <Box position={at(cx, cy - 200, 1.5)} size={[0.9, 1.1, 0.04]} color="#D4AF37" metalness={0.4} />
    </group>
  );
}

function Study({
  cx,
  cy,
  at,
}: {
  cx: number;
  cy: number;
  at: (mx: number, my: number, y: number) => [number, number, number];
}) {
  return (
    <group>
      <Box position={at(cx, cy + 400, 0.74)} size={[1.4, 0.08, 0.65]} color="#3E3832" />
      <Box position={at(cx, cy + 200, 0.46)} size={[0.42, 0.88, 0.42]} color="#C5A880" />
      <Box position={at(cx + 900, cy, 1.1)} size={[0.28, 1.8, 1.4]} color="#4A4038" />
    </group>
  );
}
