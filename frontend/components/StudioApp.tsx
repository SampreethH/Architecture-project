"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AtelierDock from "@/components/AtelierDock";
import CadViewer from "@/components/CadViewer";
import InkCanvas from "@/components/InkCanvas";
import StudioChat, { type ChatMessage } from "@/components/StudioChat";
import ExportPicker, { type ExportChoice } from "@/components/ExportPicker";
import TourOverlay from "@/components/TourOverlay";
import { buildTourStops } from "@/lib/homeTour";
import {
  bakeViewTo3d,
  defaultViews,
  newLabel,
  newStroke,
  nextApproval,
  type AtelierTool,
} from "@/lib/atelier";
import { createDetail } from "@/lib/details";
import {
  exportDwg,
  exportDxf,
  exportJson,
  exportKmz,
  exportObj,
  exportSkp,
  exportSketchup,
} from "@/lib/exportDxf";
import { DEFAULT_CONSTRAINTS, generateLayout, parseBrief } from "@/lib/generateLayout";
import { vectorizeSketch } from "@/lib/sketchVectorizer";
import {
  DETAIL_PRESETS,
  type Constraints,
  type DetailKind,
  type Layout,
  type Point,
} from "@/lib/types";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi. Tell me the house in everyday words — for example “2 bedroom home, north entry, big living room”. You can also upload a photo of a sketch you drew by hand, including notes and changes. I will build a 3D model you can download for SketchUp or AutoCAD.",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function keepMarks(current: Layout, next: Layout): Layout {
  return {
    ...next,
    details: current.details ?? [],
    views: current.views?.length ? current.views : defaultViews(),
    ink: current.ink ?? [],
    labels: current.labels ?? [],
  };
}

export default function StudioApp() {
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [layout, setLayout] = useState<Layout>(() => generateLayout(DEFAULT_CONSTRAINTS));
  const [morph, setMorph] = useState(0.2);
  const [status, setStatus] = useState("Ready. Describe a house or upload a sketch.");
  const [exporting, setExporting] = useState(false);
  const [tool, setTool] = useState<AtelierTool>("orbit");
  const [activeViewId, setActiveViewId] = useState("view-1");
  const [preview, setPreview] = useState<[Point, Point] | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(true);
  const searchParams = useSearchParams();

  const details = layout.details ?? [];
  const views = layout.views?.length ? layout.views : defaultViews();
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];
  const sketching = ["partition", "millwork", "glazing", "furniture", "stair"].includes(tool);
  const sketchKind = (sketching ? tool : "partition") as DetailKind;
  const drawing = tool === "ink" || tool === "label" || sketching;
  const tourStops = useMemo(() => buildTourStops(layout), [layout]);

  const summary = useMemo(
    () =>
      `${layout.rooms.length} rooms · ${layout.metadata.total_area_sqm.toFixed(0)} m² · ${details.length} extra 3D pieces`,
    [layout, details.length],
  );

  useEffect(() => {
    if (searchParams.get("tour") === "1") {
      setTouring(true);
      setTourIndex(0);
      setTourPlaying(true);
      setMorph(0);
      setTool("orbit");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!touring || !tourPlaying || tourStops.length < 2) return;
    const timer = window.setInterval(() => {
      setTourIndex((cur) => (cur + 1) % tourStops.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [touring, tourPlaying, tourStops.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreview(null);
        setTouring(false);
      }
      if ((event.key === "z" || event.key === "Z") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setLayout((cur) => ({ ...cur, details: (cur.details ?? []).slice(0, -1) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commitSketch = (a: Point, b: Point) => {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 80) return;
    const next = createDetail(sketchKind, [a, b]);
    setLayout((cur) => ({ ...cur, details: [...(cur.details ?? []), next] }));
    setStatus(`Added a ${DETAIL_PRESETS[sketchKind].label.toLowerCase()}.`);
  };

  const replyFromLayout = (next: Layout, usedPhoto: boolean) => {
    const rooms = next.rooms.map((room) => room.name).slice(0, 6).join(", ");
    return usedPhoto
      ? `I read your hand drawing and built a 3D house from it. Rooms I found: ${rooms}. Look at the model on the right. When it looks right, download SketchUp or AutoCAD files below.`
      : `I built a ${next.rooms.length}-room layout from your note (${next.metadata.total_area_sqm.toFixed(0)} m²). Rooms: ${rooms}. Spin the 3D view, draw extra walls if you like, then download it for SketchUp or AutoCAD.`;
  };

  const applyChat = async (text: string, file: File | null) => {
    setPending(true);
    const imageUrl = file ? URL.createObjectURL(file) : undefined;
    setMessages((cur) => [
      ...cur,
      {
        id: uid("user"),
        role: "user",
        text: text || "Please turn this hand drawing into 3D.",
        imageName: file?.name,
        imageUrl,
      },
    ]);
    setDraft("");
    try {
      const parsed = text ? parseBrief(text, constraints) : constraints;
      setConstraints(parsed);
      let next: Layout;
      if (file) {
        setStatus("Reading your hand drawing…");
        next = keepMarks(layout, await vectorizeSketch(file, parsed));
        next = {
          ...next,
          metadata: { ...next.metadata, brief: text || next.metadata.brief },
        };
      } else {
        setStatus("Building the house from your words…");
        next = keepMarks(layout, generateLayout(parsed));
      }
      setLayout(next);
      setMorph(0.15);
      const answer = replyFromLayout(next, Boolean(file));
      setMessages((cur) => [...cur, { id: uid("bot"), role: "assistant", text: answer }]);
      setStatus("3D is ready. You can keep chatting to change it.");
    } catch (error) {
      const fail = error instanceof Error ? error.message : "Could not build the 3D house.";
      setStatus(fail);
      setMessages((cur) => [
        ...cur,
        {
          id: uid("bot"),
          role: "assistant",
          text: "I could not read that yet. Try a clearer photo of the sketch, or type something like “3 BHK, 1500 sq ft, open kitchen”.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const pickFormat = async (choice: ExportChoice) => {
    const jobs: Record<ExportChoice, { label: string; work: () => Promise<void> | void }> = {
      skp: { label: "SketchUp pack (includes Save-as-SKP)", work: () => exportSkp(layout) },
      dae: { label: "SketchUp .dae", work: () => exportSketchup(layout) },
      kmz: { label: "SketchUp .kmz", work: () => exportKmz(layout) },
      obj: { label: "3D .obj", work: () => exportObj(layout) },
      dxf: { label: "AutoCAD / ZWCAD .dxf", work: () => exportDxf(layout) },
      dwg: { label: "CAD pack", work: () => exportDwg(layout) },
      json: {
        label: "JSON copy",
        work: () => {
          exportJson(layout);
        },
      },
    };
    const job = jobs[choice];
    setPickerOpen(false);
    await runExport(job.label, job.work);
  };

  const runExport = async (label: string, work: () => Promise<void> | void) => {
    try {
      setExporting(true);
      setStatus(`Preparing ${label}…`);
      await work();
      setStatus(`${label} downloaded. Open it in that app.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed. Is the backend running?");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-onyx-950 text-titanium-bright">
      <div className="pointer-events-none absolute inset-0 grain" />
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 md:px-8">
        <div>
          <p className="font-display text-[11px] tracking-arch text-champagne">DRAWING PAGE</p>
          <p className="font-sans text-sm text-white">Chat, draw, then download 3D</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden font-sans text-xs text-titanium md:block">{summary}</p>
          <Link href="/" className="rounded-full border border-white/15 px-4 py-1.5 font-sans text-sm">
            Back to home
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-[1680px] gap-4 px-4 pb-6 lg:grid-cols-[320px_minmax(0,1fr)] md:px-6">
        <StudioChat
          messages={messages}
          draft={draft}
          onDraft={setDraft}
          pending={pending}
          onSend={applyChat}
          status={status}
        />

        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 lg:min-h-[560px]">
            <HeroScene
              layout={layout}
              morph={morph}
              sketching={sketching && !touring}
              sketchKind={sketchKind}
              orbitEnabled={tool === "orbit" && !touring}
              details={details}
              preview={preview}
              activeView={activeView}
              tourMode={touring}
              tourStop={tourStops[tourIndex]}
              onCommitSketch={commitSketch}
              onPreview={setPreview}
            />
            <InkCanvas
              viewId={activeView.id}
              strokes={layout.ink ?? []}
              labels={layout.labels ?? []}
              mode={tool === "ink" ? "ink" : tool === "label" ? "label" : "off"}
              onStroke={(points) =>
                setLayout((cur) => ({
                  ...cur,
                  ink: [...(cur.ink ?? []), newStroke(activeView.id, points)],
                }))
              }
              onLabel={(position, text) =>
                setLayout((cur) => ({
                  ...cur,
                  labels: [...(cur.labels ?? []), newLabel(activeView.id, position, text)],
                }))
              }
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-onyx-950/55 to-transparent" />
            {touring ? (
              <TourOverlay
                stops={tourStops}
                index={tourIndex}
                playing={tourPlaying}
                onClose={() => setTouring(false)}
                onPrev={() => setTourIndex((cur) => (cur - 1 + tourStops.length) % tourStops.length)}
                onNext={() => setTourIndex((cur) => (cur + 1) % tourStops.length)}
                onToggle={() => setTourPlaying((cur) => !cur)}
              />
            ) : (
              <div className={`pointer-events-none absolute left-5 top-5 max-w-md ${drawing ? "opacity-40" : ""}`}>
                <p className="font-sans text-xs text-cobalt">3D house</p>
                <h1 className="font-display text-3xl text-white">Your model</h1>
                <p className="mt-1 font-sans text-sm text-titanium">
                  Drag to look around, or start a home tour to see the rooms after completion.
                </p>
              </div>
            )}
            {touring ? null : (
            <div className="absolute bottom-4 left-4 w-[min(100%-2rem,280px)]">
              <div className="glass rounded-2xl px-4 py-3">
                <div className="mb-2 flex justify-between font-sans text-xs text-titanium">
                  <span>More 3D</span>
                  <span>Flatter floor plan</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={morph}
                  onChange={(e) => setMorph(Number(e.target.value))}
                  className="w-full accent-[#D4AF37]"
                />
              </div>
            </div>
            )}
          </div>
          <AtelierDock
            views={views}
            activeId={activeView.id}
            tool={tool}
            exporting={exporting}
            touring={touring}
            onTour={() => {
              setTouring(true);
              setTourIndex(0);
              setTourPlaying(true);
              setMorph(0);
              setTool("orbit");
              setStatus("Walking through the finished home.");
            }}
            onSelect={(id) => {
              setActiveViewId(id);
              setMorph(0.1);
            }}
            onSaveView={() => {
              const id = `view-${Date.now()}`;
              const next = {
                id,
                name: `View ${views.length + 1}`,
                position: [9, 6, 10] as [number, number, number],
                target: [0, 1, 0] as [number, number, number],
                approval: "draft" as const,
                stamps: [],
              };
              setLayout((cur) => ({ ...cur, views: [...(cur.views?.length ? cur.views : views), next] }));
              setActiveViewId(id);
            }}
            onAdvance={() => {
              const nxt = nextApproval(activeView.approval);
              setLayout((cur) => ({
                ...cur,
                views: (cur.views?.length ? cur.views : views).map((view) =>
                  view.id === activeView.id
                    ? {
                        ...view,
                        approval: nxt,
                        stamps: [...view.stamps, `${nxt} ${new Date().toLocaleTimeString()}`],
                      }
                    : view,
                ),
              }));
              setStatus(
                nxt === "submitted"
                  ? "Saved your drawing. Confirm it looks right."
                  : nxt === "approved"
                    ? "Looks good. Tap Make it 3D."
                    : "This view is now 3D.",
              );
            }}
            onTool={(next) => {
              setTool(next);
              setMorph(0.08);
            }}
            onBake={() => {
              if (activeView.approval !== "approved") {
                setStatus("First tap “I am done drawing”, then “Yes, this is right”.");
                return;
              }
              const baked = bakeViewTo3d(layout, activeView, layout.ink ?? [], layout.labels ?? []);
              setLayout((cur) => ({
                ...cur,
                details: [...(cur.details ?? []), ...baked],
                views: (cur.views?.length ? cur.views : views).map((view) =>
                  view.id === activeView.id ? { ...view, approval: "baked" } : view,
                ),
              }));
              setStatus(`Turned ${baked.length} sketch marks into 3D pieces.`);
            }}
            onExportSkp={() => setPickerOpen(true)}
            onExportDwg={() => setPickerOpen(true)}
          />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[1680px] space-y-4 px-4 pb-16 md:px-6">
        <div className="glass rounded-[28px] p-5">
          <p className="font-display text-lg text-white">Download for the apps you use</p>
          <p className="mt-1 max-w-3xl font-sans text-sm leading-relaxed text-titanium">
            Choose SketchUp, AutoCAD, OBJ, or a backup file. The house is built as walls, roof,
            glass, and furniture — ready to open, not a hollow box.
          </p>
          <div className="mt-4">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setPickerOpen(true)}
              className="rounded-full bg-champagne px-5 py-2.5 font-sans text-sm font-semibold text-onyx-950"
            >
              Choose file type and download
            </button>
          </div>
        </div>

        <CadViewer
          layout={layout}
          exporting={exporting}
          onExportDxf={() => runExport("AutoCAD / ZWCAD drawing (.dxf)", () => exportDxf(layout))}
          onExportSketchup={() => setPickerOpen(true)}
        />
      </section>
      <ExportPicker
        open={pickerOpen}
        exporting={exporting}
        onClose={() => setPickerOpen(false)}
        onPick={pickFormat}
      />
    </div>
  );
}
