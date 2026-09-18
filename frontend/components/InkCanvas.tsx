"use client";

import { useRef } from "react";
import type { HandLabel, InkStroke, Point } from "@/lib/types";

export default function InkCanvas({
  viewId,
  strokes,
  labels,
  mode,
  onStroke,
  onLabel,
}: {
  viewId: string;
  strokes: InkStroke[];
  labels: HandLabel[];
  mode: "ink" | "label" | "off";
  onStroke: (points: Point[]) => void;
  onLabel: (position: Point, text: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const live = useRef<Point[]>([]);
  const drawing = useRef(false);

  const toUv = (event: React.PointerEvent): Point | null => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    return [
      Math.max(0, Math.min(1000, ((event.clientX - box.left) / box.width) * 1000)),
      Math.max(0, Math.min(1000, ((event.clientY - box.top) / box.height) * 1000)),
    ];
  };

  const mine = strokes.filter((s) => s.viewId === viewId);
  const notes = labels.filter((l) => l.viewId === viewId);

  return (
    <svg
      ref={svg}
      className={`absolute inset-0 z-10 h-full w-full ${mode === "off" ? "pointer-events-none" : "cursor-crosshair"}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      onPointerDown={(event) => {
        if (mode === "off" || event.button !== 0) return;
        const uv = toUv(event);
        if (!uv) return;
        if (mode === "label") {
          const text = window.prompt("Write a short note on the drawing", "");
          if (text?.trim()) onLabel(uv, text.trim());
          return;
        }
        drawing.current = true;
        live.current = [uv];
        svg.current?.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drawing.current || mode !== "ink") return;
        const uv = toUv(event);
        if (uv) live.current.push(uv);
      }}
      onPointerUp={() => {
        if (drawing.current && live.current.length > 1) onStroke(live.current);
        drawing.current = false;
        live.current = [];
      }}
    >
      {mine.map((stroke) => (
        <polyline
          key={stroke.id}
          fill="none"
          stroke={stroke.color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={stroke.points.map((p) => p.join(",")).join(" ")}
        />
      ))}
      {notes.map((label) => (
        <g key={label.id}>
          <text
            x={label.position[0]}
            y={label.position[1]}
            fill="#E8D5A3"
            fontSize="28"
            fontFamily="Georgia, 'Palatino Linotype', serif"
            fontStyle="italic"
          >
            {label.text}
          </text>
        </g>
      ))}
    </svg>
  );
}
