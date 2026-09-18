import { Suspense } from "react";
import StudioApp from "@/components/StudioApp";

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-onyx-950" />}>
      <StudioApp />
    </Suspense>
  );
}
