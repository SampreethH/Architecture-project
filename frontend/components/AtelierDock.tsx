"use client";

import { TOOL_LABELS, type AtelierTool } from "@/lib/atelier";
import type { Approval, SavedView } from "@/lib/types";

const STEPS: Approval[] = ["draft", "submitted", "approved", "baked"];

const STEP_LABEL: Record<Approval, string> = {
  draft: "Sketch",
  submitted: "Ready to check",
  approved: "Looks good",
  baked: "Turned into 3D",
};

export default function AtelierDock({
  views,
  activeId,
  tool,
  onSelect,
  onSaveView,
  onAdvance,
  onTool,
  onBake,
  onExportSkp,
  onExportDwg,
  exporting,
}: {
  views: SavedView[];
  activeId: string;
  tool: AtelierTool;
  onSelect: (id: string) => void;
  onSaveView: () => void;
  onAdvance: () => void;
  onTool: (tool: AtelierTool) => void;
  onBake: () => void;
  onExportSkp: () => void;
  onExportDwg: () => void;
  exporting?: boolean;
}) {
  const active = views.find((v) => v.id === activeId) ?? views[0];
  const canBake = active?.approval === "approved";
  const tools: AtelierTool[] = ["orbit", "ink", "label", "partition", "millwork", "glazing"];

  return (
    <div className="glass w-full rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {views.map((view, index) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view.id)}
            className={`rounded-full border px-2.5 py-1 font-sans text-xs ${
              view.id === activeId
                ? "border-cobalt/50 bg-cobalt/15 text-cobalt"
                : "border-white/10 text-titanium"
            }`}
          >
            {index === 0 ? "3D view" : index === 1 ? "Front" : index === 2 ? "From above" : view.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onSaveView}
          className="rounded-full border border-white/15 px-2.5 py-1 font-sans text-xs text-champagne-mist"
        >
          + Save this angle
        </button>
        <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" />
        {tools.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTool(item)}
            className={`rounded-full border px-2.5 py-1 font-sans text-xs ${
              tool === item ? "border-champagne/50 text-champagne-mist" : "border-white/10 text-titanium"
            }`}
          >
            {TOOL_LABELS[item]}
          </button>
        ))}
      </div>

      <p className="mt-2 font-sans text-xs leading-relaxed text-titanium/80">
        Look around to spin the house. Draw to sketch. Wall or Window: click two points on the floor.
        Then: I am done drawing → Yes, this is right → Make it 3D.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {STEPS.map((step) => (
          <span
            key={step}
            className={`rounded-full px-2 py-0.5 font-sans text-[10px] ${
              active?.approval === step ? "bg-champagne/20 text-champagne-mist" : "text-titanium/50"
            }`}
          >
            {STEP_LABEL[step]}
          </span>
        ))}
        <button
          type="button"
          onClick={onAdvance}
          disabled={active?.approval === "baked"}
          className="rounded-full border border-white/15 px-3 py-1.5 font-sans text-xs text-titanium-bright disabled:opacity-40"
        >
          {active?.approval === "draft"
            ? "I am done drawing"
            : active?.approval === "submitted"
              ? "Yes, this is right"
              : active?.approval === "approved"
                ? "Ready for 3D"
                : "Already 3D"}
        </button>
        <button
          type="button"
          onClick={onBake}
          disabled={!canBake}
          className="rounded-full bg-champagne px-3 py-1.5 font-sans text-xs font-semibold text-onyx-950 disabled:opacity-40"
        >
          Make it 3D
        </button>
        <button
          type="button"
          onClick={onExportSkp}
          disabled={exporting}
          className="rounded-full bg-champagne px-3 py-1.5 font-sans text-xs font-semibold text-onyx-950"
        >
          Download…
        </button>
      </div>
    </div>
  );
}

export { nextApproval };