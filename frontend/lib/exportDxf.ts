import type { Layout } from "./types";

async function download(path: string, layout: Layout, filename: string, fallback: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || fallback);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportDxf(layout: Layout) {
  return download(
    "/cad-api/export/dxf",
    layout,
    "cadence-zwcad-plan.dxf",
    "ZWCAD DXF export failed. Start the FastAPI engine on :8000.",
  );
}

export function exportSketchup(layout: Layout) {
  return download(
    "/cad-api/export/sketchup",
    layout,
    "Cadence-House.dae",
    "SketchUp Collada export failed. Start the FastAPI engine on :8000.",
  );
}

export function exportSkp(layout: Layout) {
  return download(
    "/cad-api/export/skp",
    layout,
    "Cadence-House-SketchUp.zip",
    "SketchUp pack failed. Start the FastAPI engine on :8000.",
  );
}

export function exportDwg(layout: Layout) {
  return download(
    "/cad-api/export/dwg",
    layout,
    "Cadence-ZWCAD.dwg.zip",
    "ZWCAD DWG pack failed. Start the FastAPI engine on :8000.",
  );
}

export function exportKmz(layout: Layout) {
  return download(
    "/cad-api/export/kmz",
    layout,
    "Cadence-House.kmz",
    "KMZ export failed. Start the FastAPI engine on :8000.",
  );
}

export function exportObj(layout: Layout) {
  return download(
    "/cad-api/export/obj",
    layout,
    "Cadence-House-OBJ.zip",
    "OBJ export failed. Start the FastAPI engine on :8000.",
  );
}

export function exportJson(layout: Layout) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cadence-design.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
