"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  layoutExtents,
  openingLeaf,
  polygonPerimeterMm,
  roomCentroid,
} from "@/lib/geometry";
import { CAD_LAYERS, DETAIL_PRESETS, type CadLayerId, type Layout, type Room } from "@/lib/types";

const LAYER_ON: Record<CadLayerId, boolean> = {
  "A-WALL-EXTR": true,
  "A-WALL-INTR": true,
  "A-DOOR": true,
  "A-GLAZ": true,
  "A-ANNO-TEXT": true,
  "A-ANNO-DIMS": true,
};

export default function CadViewer({
  layout,
  onExportDxf,
  onExportSketchup,
  exporting,
}: {
  layout: Layout;
  onExportDxf: () => void;
  onExportSketchup: () => void;
  exporting?: boolean;
}) {
  const [layers, setLayers] = useState(LAYER_ON);
  const [grid, setGrid] = useState<"ortho" | "iso">("ortho");
  const [showGrid, setShowGrid] = useState(true);
  const [hover, setHover] = useState<Room | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const extents = useMemo(
    () => layoutExtents(layout.rooms, layout.walls),
    [layout],
  );
  const pad = 1100;
  const width = extents.maxX - extents.minX + pad * 2;
  const height = extents.maxY - extents.minY + pad * 2;
  const vb = `${extents.minX - pad} ${-(extents.maxY + pad)} ${width} ${height}`;

  const flip = (y: number) => -y;
  const gridStartX = Math.floor((extents.minX - pad) / 1000) * 1000;
  const gridEndX = Math.ceil((extents.maxX + pad) / 1000) * 1000;
  const gridStartY = Math.floor((extents.minY - pad) / 1000) * 1000;
  const gridEndY = Math.ceil((extents.maxY + pad) / 1000) * 1000;
  const vLines = [];
  const hLines = [];
  for (let x = gridStartX; x <= gridEndX; x += 1000) vLines.push(x);
  for (let y = gridStartY; y <= gridEndY; y += 1000) hLines.push(y);

  return (
    <section className="relative flex h-full min-h-[540px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0E1014]/80 shadow-glass backdrop-blur-glass">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-3">
        <div>
          <p className="font-sans text-sm text-champagne-soft/90">
            Floor plan
          </p>
          <p className="font-sans text-xs text-titanium">
            Scale {layout.metadata.scale} · {layout.metadata.total_area_sqm.toFixed(1)} m²
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle pressed={showGrid} onClick={() => setShowGrid((v) => !v)}>
            Grid
          </Toggle>
          <Toggle
            pressed={grid === "iso"}
            onClick={() => setGrid((g) => (g === "ortho" ? "iso" : "ortho"))}
          >
            {grid === "iso" ? "Isometric" : "Orthogonal"}
          </Toggle>
          <button
            type="button"
            onClick={onExportDxf}
            disabled={exporting}
            className="magnetic rounded-full border border-champagne/40 bg-champagne/15 px-4 py-1.5 font-display text-[11px] tracking-[0.18em] text-champagne-mist transition hover:bg-champagne/25 disabled:opacity-50"
          >
            {exporting ? "Working…" : "AutoCAD / ZWCAD"}
          </button>
          <button
            type="button"
            onClick={onExportSketchup}
            disabled={exporting}
            className="rounded-full border border-cobalt/40 bg-cobalt/10 px-4 py-1.5 font-display text-[11px] tracking-[0.18em] text-cobalt transition hover:bg-cobalt/20 disabled:opacity-50"
          >
            SketchUp / more formats
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-white/8 p-4 md:block">
          <p className="mb-3 font-sans text-xs text-titanium">
            Show / hide
          </p>
          <ul className="space-y-1.5">
            {CAD_LAYERS.map((layer) => (
              <li key={layer.id}>
                <button
                  type="button"
                  onClick={() =>
                    setLayers((cur) => ({ ...cur, [layer.id]: !cur[layer.id] }))
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition ${
                    layers[layer.id]
                      ? "border-white/10 bg-white/5"
                      : "border-transparent opacity-40"
                  }`}
                >
                  <span className="font-sans text-[11px] text-titanium-bright">
                    {layer.label}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: layer.swatch }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div
          className="relative min-h-[460px] min-w-0 flex-1 cursor-crosshair overflow-hidden bg-[#0B0C10]"
          style={{ perspective: "1400px" }}
          onWheel={(event) => {
            event.preventDefault();
            setZoom((z) => Math.min(4, Math.max(0.45, z * (event.deltaY > 0 ? 0.92 : 1.08))));
          }}
          onPointerDown={(event) => {
            drag.current = {
              x: pan.x,
              y: pan.y,
              px: event.clientX,
              py: event.clientY,
            };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({
              x: drag.current.x + (event.clientX - drag.current.px),
              y: drag.current.y + (event.clientY - drag.current.py),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerLeave={() => {
            drag.current = null;
          }}
        >
          <svg
            viewBox={vb}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
            style={{
              transform: `${grid === "iso" ? "rotateX(58deg) rotateZ(-32deg)" : ""} translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center",
              transition: drag.current ? "none" : "transform 400ms ease",
            }}
          >
            {showGrid && (
              <g opacity={0.35}>
                {vLines.map((x) => (
                  <line
                    key={`vx-${x}`}
                    x1={x}
                    y1={flip(extents.minY - pad)}
                    x2={x}
                    y2={flip(extents.maxY + pad)}
                    stroke={x % 5000 === 0 ? "#C5A880" : "#1E222C"}
                    strokeWidth={x % 5000 === 0 ? 18 : 8}
                  />
                ))}
                {hLines.map((y) => (
                  <line
                    key={`hy-${y}`}
                    x1={extents.minX - pad}
                    y1={flip(y)}
                    x2={extents.maxX + pad}
                    y2={flip(y)}
                    stroke={y % 5000 === 0 ? "#C5A880" : "#1E222C"}
                    strokeWidth={y % 5000 === 0 ? 18 : 8}
                  />
                ))}
              </g>
            )}

            {layout.rooms.map((room) => {
              const d = room.bounds
                .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flip(p[1])}`)
                .join(" ") + " Z";
              return (
                <path
                  key={room.name}
                  d={d}
                  fill={hover?.name === room.name ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.015)"}
                  stroke="none"
                  onPointerEnter={() => setHover(room)}
                  onPointerLeave={() => setHover(null)}
                />
              );
            })}

            {layers["A-WALL-EXTR"] &&
              layout.walls
                .filter((w) => w.type === "exterior")
                .map((wall, i) => (
                  <line
                    key={`ex-${i}`}
                    x1={wall.start[0]}
                    y1={flip(wall.start[1])}
                    x2={wall.end[0]}
                    y2={flip(wall.end[1])}
                    stroke="#F4F1EA"
                    strokeWidth={wall.thickness}
                    strokeLinecap="square"
                  />
                ))}
            {layers["A-WALL-INTR"] &&
              layout.walls
                .filter((w) => w.type === "interior")
                .map((wall, i) => (
                  <line
                    key={`in-${i}`}
                    x1={wall.start[0]}
                    y1={flip(wall.start[1])}
                    x2={wall.end[0]}
                    y2={flip(wall.end[1])}
                    stroke="#8E9299"
                    strokeWidth={wall.thickness}
                    strokeLinecap="square"
                  />
                ))}

            {layout.openings.map((opening, i) => {
              const leaf = openingLeaf(opening);
              const hinge = opening.position;
              const isGlass = opening.type === "window" || opening.type === "casement";
              if (isGlass && !layers["A-GLAZ"]) return null;
              if (!isGlass && !layers["A-DOOR"]) return null;
              const color = isGlass ? "#00E5FF" : "#FF4B4B";
              const arc = swingPath(opening.position, opening.width, opening.inward, opening.direction);
              return (
                <g key={`op-${i}`}>
                  <line
                    x1={hinge[0]}
                    y1={flip(hinge[1])}
                    x2={leaf[0]}
                    y2={flip(leaf[1])}
                    stroke={color}
                    strokeWidth={40}
                  />
                  {!isGlass && opening.swing !== "none" && (
                    <path d={arc} fill="none" stroke={color} strokeWidth={28} />
                  )}
                  <circle cx={hinge[0]} cy={flip(hinge[1])} r={55} fill="#FF4B4B" />
                </g>
              );
            })}

            {(layout.details ?? []).map((detail) => {
              const [a, b] = [detail.path[0], detail.path[detail.path.length - 1]];
              if (!a || !b) return null;
              const color = DETAIL_PRESETS[detail.kind].swatch;
              const rect =
                (detail.kind === "furniture" || detail.kind === "millwork") &&
                Math.abs(a[0] - b[0]) > 200 &&
                Math.abs(a[1] - b[1]) > 200;
              if (rect) {
                const x = Math.min(a[0], b[0]);
                const y = Math.min(a[1], b[1]);
                return (
                  <rect
                    key={detail.id}
                    x={x}
                    y={flip(y + Math.abs(a[1] - b[1]))}
                    width={Math.abs(a[0] - b[0])}
                    height={Math.abs(a[1] - b[1])}
                    fill={`${color}22`}
                    stroke={color}
                    strokeWidth={40}
                  />
                );
              }
              return (
                <line
                  key={detail.id}
                  x1={a[0]}
                  y1={flip(a[1])}
                  x2={b[0]}
                  y2={flip(b[1])}
                  stroke={color}
                  strokeWidth={Math.max(40, detail.thickness_mm)}
                />
              );
            })}

            {layers["A-ANNO-TEXT"] &&
              layout.rooms.map((room) => {
                const [cx, cy] = roomCentroid(room.bounds);
                return (
                  <g key={`t-${room.name}`}>
                    <text
                      x={cx}
                      y={flip(cy) - 80}
                      textAnchor="middle"
                      fill="#D4AF37"
                      fontSize={220}
                      fontFamily="Syne, sans-serif"
                      letterSpacing="8"
                    >
                      {room.name.toUpperCase()}
                    </text>
                    <text
                      x={cx}
                      y={flip(cy) + 180}
                      textAnchor="middle"
                      fill="#C8CCD3"
                      fontSize={160}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {room.area_sqm.toFixed(1)} SQ.M
                    </text>
                  </g>
                );
              })}

            {layers["A-ANNO-DIMS"] && (
              <g stroke="#7CFF9B" fill="#7CFF9B" strokeWidth={30}>
                <line
                  x1={extents.minX}
                  y1={flip(extents.minY) + 700}
                  x2={extents.maxX}
                  y2={flip(extents.minY) + 700}
                />
                <text
                  x={(extents.minX + extents.maxX) / 2}
                  y={flip(extents.minY) + 980}
                  textAnchor="middle"
                  fontSize={180}
                  fontFamily="JetBrains Mono, monospace"
                  stroke="none"
                >
                  {((extents.maxX - extents.minX) / 1000).toFixed(2)} m
                </text>
                <line
                  x1={extents.minX - 700}
                  y1={flip(extents.minY)}
                  x2={extents.minX - 700}
                  y2={flip(extents.maxY)}
                />
                <text
                  x={extents.minX - 980}
                  y={flip((extents.minY + extents.maxY) / 2)}
                  textAnchor="middle"
                  fontSize={180}
                  fontFamily="JetBrains Mono, monospace"
                  stroke="none"
                  transform={`rotate(-90 ${extents.minX - 980} ${flip((extents.minY + extents.maxY) / 2)})`}
                >
                  {((extents.maxY - extents.minY) / 1000).toFixed(2)} m
                </text>
              </g>
            )}
          </svg>

          {hover && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-[#0A0B0E]/80 px-4 py-3 backdrop-blur-glass">
              <p className="font-display text-sm text-champagne-mist">{hover.name}</p>
              <p className="font-mono text-[11px] text-cobalt">
                {hover.area_sqm.toFixed(2)} SQ.M · PERIM{" "}
                {(polygonPerimeterMm(hover.bounds) / 1000).toFixed(2)} m
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-telemetry transition ${
        pressed
          ? "border-cobalt/40 bg-cobalt/10 text-cobalt"
          : "border-white/10 text-titanium hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function swingPath(
  hinge: [number, number],
  width: number,
  inward: [number, number],
  direction: [number, number],
): string {
  const leafX = hinge[0] + direction[0] * width;
  const leafY = hinge[1] + direction[1] * width;
  const openX = hinge[0] + inward[0] * width;
  const openY = hinge[1] + inward[1] * width;
  return `M ${leafX} ${-leafY} A ${width} ${width} 0 0 1 ${openX} ${-openY}`;
}
