"use client";

import type { TourStop } from "@/lib/homeTour";

export default function TourOverlay({
  stops,
  index,
  playing,
  onClose,
  onPrev,
  onNext,
  onToggle,
}: {
  stops: TourStop[];
  index: number;
  playing: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
}) {
  const stop = stops[index];
  if (!stop) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="pointer-events-auto ml-auto flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/15 bg-black/40 px-4 py-1.5 font-sans text-sm text-white"
        >
          Exit tour
        </button>
      </div>
      <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-black/55 px-5 py-4 backdrop-blur-md">
        <p className="font-sans text-xs tracking-wide text-cobalt">
          Home tour · after completion · {index + 1} / {stops.length}
        </p>
        <h2 className="mt-1 font-display text-2xl text-white">{stop.title}</h2>
        <p className="mt-1 font-sans text-sm leading-relaxed text-titanium-bright">{stop.caption}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full border border-white/15 px-3 py-1.5 font-sans text-xs text-white"
          >
            Previous room
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full bg-champagne px-3 py-1.5 font-sans text-xs font-semibold text-onyx-950"
          >
            {playing ? "Pause" : "Play tour"}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-full border border-white/15 px-3 py-1.5 font-sans text-xs text-white"
          >
            Next room
          </button>
        </div>
      </div>
    </div>
  );
}
