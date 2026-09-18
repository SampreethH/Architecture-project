"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bindHeroPointer } from "@/lib/heroPointer";
import { DEFAULT_CONSTRAINTS, generateLayout } from "@/lib/generateLayout";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const STEPS = [
  {
    n: "1",
    title: "Tell us what you want",
    body: "Type a simple note — like “3 bedroom house with an open kitchen” — or take a photo of a sketch you drew by hand.",
  },
  {
    n: "2",
    title: "See it as a 3D house",
    body: "We turn that into a floor plan and a 3D model you can spin around. You can draw extra walls and notes on a separate drawing page.",
  },
  {
    n: "3",
    title: "Download the format you need",
    body: "Choose SketchUp, AutoCAD, OBJ, or a CAD pack. Open the file in the app you already use.",
  },
];

export default function LandingPage() {
  const layout = useMemo(() => generateLayout(DEFAULT_CONSTRAINTS), []);
  const [morph] = useState(0.12);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const fake = {
        currentTarget: {
          getBoundingClientRect: () =>
            document.getElementById("hero-stage")?.getBoundingClientRect() ??
            new DOMRect(0, 0, window.innerWidth, window.innerHeight),
        },
        clientX: event.clientX,
        clientY: event.clientY,
      };
      bindHeroPointer(fake as never);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-onyx-950 text-titanium-bright">
      <div className="pointer-events-none absolute inset-0 grain" />

      <nav className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
        <div>
          <p className="font-display text-[11px] tracking-arch text-champagne">CADENCE</p>
          <p className="font-sans text-xs text-titanium">Draw a house. Get 3D. Open it in SketchUp or AutoCAD.</p>
        </div>
        <Link
          href="/studio"
          className="magnetic rounded-full bg-champagne px-5 py-2 font-sans text-sm font-medium text-onyx-950"
        >
          Start drawing
        </Link>
      </nav>

      <div id="hero-stage" className="relative h-[68vh] min-h-[480px]" onPointerMove={bindHeroPointer}>
        <HeroScene layout={layout} morph={morph} sketching={false} heroMode />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-onyx-950/20 via-transparent to-onyx-950" />
        <div className="pointer-events-none absolute left-6 top-10 z-10 max-w-xl md:left-12">
          <p className="mb-3 font-sans text-xs tracking-wide text-cobalt">A simple drawing studio</p>
          <h1 className="font-display text-4xl leading-[0.95] text-white md:text-6xl">
            Sketch on paper.
            <span className="block text-champagne-soft">See it as a 3D home.</span>
          </h1>
          <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-titanium">
            You do not need CAD experience. Describe the house in everyday words, or upload a
            hand drawing. We build a realistic 3D model. You download the format your software needs.
          </p>
          <div className="pointer-events-auto mt-7 flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="magnetic rounded-full bg-champagne px-6 py-3 font-sans text-sm font-semibold text-onyx-950"
            >
              Open the drawing page
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-white/15 px-6 py-3 font-sans text-sm text-titanium-bright"
            >
              How it works
            </a>
          </div>
        </div>
      </div>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <p className="font-sans text-sm text-titanium">Move your mouse over the house — it turns with you. Drawing happens on the next page.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.n} className="glass rounded-3xl p-6">
              <p className="font-display text-2xl text-champagne">{step.n}</p>
              <h2 className="mt-3 font-display text-xl text-white">{step.title}</h2>
              <p className="mt-2 font-sans text-sm leading-relaxed text-titanium">{step.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/studio"
            className="magnetic rounded-full bg-white px-8 py-3 font-sans text-sm font-semibold text-onyx-950"
          >
            Go to the drawing page
          </Link>
        </div>
      </section>
    </div>
  );
}
