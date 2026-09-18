from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .dxf_builder import build_dxf
from .handoff import sketchup_kmz, sketchup_pack, zwcad_pack
from .models import Layout
from .sketchup_builder import build_collada, build_obj

app = FastAPI(
    title="Cadence Studio CAD API",
    version="1.3.0",
    description="Premium house massing and multi-format handoff.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "formats": "dae,kmz,obj,dxf,dwg-pack,skp-pack",
    }


def _require(layout: Layout) -> None:
    if not layout.rooms:
        raise HTTPException(status_code=400, detail="Layout must include rooms.")


@app.post("/export/dxf")
def export_dxf(layout: Layout) -> Response:
    _require(layout)
    if not layout.walls:
        raise HTTPException(status_code=400, detail="Layout must include walls.")
    return Response(
        content=build_dxf(layout),
        media_type="application/dxf",
        headers={"Content-Disposition": 'attachment; filename="cadence-plan.dxf"'},
    )


@app.post("/export/sketchup")
def export_sketchup(layout: Layout) -> Response:
    _require(layout)
    return Response(
        content=build_collada(layout),
        media_type="model/vnd.collada+xml",
        headers={"Content-Disposition": 'attachment; filename="Cadence-House.dae"'},
    )


@app.post("/export/kmz")
def export_kmz(layout: Layout) -> Response:
    _require(layout)
    return Response(
        content=sketchup_kmz(layout),
        media_type="application/vnd.google-earth.kmz",
        headers={"Content-Disposition": 'attachment; filename="Cadence-House.kmz"'},
    )


@app.post("/export/obj")
def export_obj(layout: Layout) -> Response:
    _require(layout)
    obj, mtl = build_obj(layout)
    buf = BytesIO()
    with ZipFile(buf, "w", ZIP_DEFLATED) as zf:
        zf.writestr("Cadence-House.obj", obj)
        zf.writestr("cadence-house.mtl", mtl)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="Cadence-House-OBJ.zip"'},
    )


@app.post("/export/skp")
def export_skp(layout: Layout) -> Response:
    _require(layout)
    return Response(
        content=sketchup_pack(layout),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="Cadence-House-SketchUp.zip"'},
    )


@app.post("/export/dwg")
def export_dwg(layout: Layout) -> Response:
    _require(layout)
    return Response(
        content=zwcad_pack(layout),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="Cadence-Plan-CAD.zip"'},
    )
