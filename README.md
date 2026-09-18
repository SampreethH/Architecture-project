# Cadence Studio

Generative drafting aligned to this office stack:

| Discipline | Tool |
|---|---|
| Project management | None |
| 2D, layout, details | **ZWCAD** |
| 3D detailing | **SketchUp** |
| Rendering | **Enscape** |

Cadence generates millimetre vector JSON, then hands off:

- **ZWCAD `.DXF`** (R2018 / `AC1032`, AIA layers) for plans, layouts, and details
- **SketchUp `.DAE`** (Collada, Z-up, metres) for 3D massing — import, detail, then Enscape

## Architecture

```
Architecture-project/
├── frontend/                 Next.js 15 · React Three Fiber · Tailwind
│   ├── app/                  Landing + studio shell
│   ├── components/
│   │   ├── HeroScene.tsx     Parametric wireframe pavilion, mouse inertia, 3D→2D morph
│   │   ├── CadViewer.tsx     ZWCAD-oriented vector viewport + dual export
│   │   └── StudioApp.tsx     Brief, sliders, sketch vectorizer
│   └── lib/                  JSON coordinate protocol + geometry engine
└── backend/                  FastAPI
    └── app/
        ├── main.py           POST /export/dxf  POST /export/sketchup
        ├── models.py         Layout JSON schema
        ├── dxf_builder.py    ZWCAD walls, door arcs, glazing, dims
        └── sketchup_builder.py  Collada massing for SketchUp → Enscape
```

## Run locally

Requires Node 20+ and Python 3.11+.

```bash
# API
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Web
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `/cad-api/*` proxies to FastAPI.

## Handoff

1. Generate the plan in Cadence.
2. **ZWCAD .DXF** → open in ZWCAD (`File → Open` / insert as overlay) for 2D layouts and details.
3. **SketchUp .DAE** → SketchUp `File → Import` (Collada). Units: metres, Z-up. Detail the massing.
4. Launch **Enscape** from SketchUp for rendering.
5. There is no PM / issue tracker in this pipeline.

## JSON protocol

Generation never rasterizes. The spatial engine emits millimetre coordinates:

```json
{
  "metadata": { "unit": "mm", "scale": "1:100", "total_area_sqm": 139.35 },
  "rooms": [{ "name": "Grand Foyer", "bounds": [[0,0],[3000,0],[3000,2500],[0,2500]], "area_sqm": 7.5 }],
  "walls": [{ "start": [0,0], "end": [9000,0], "thickness": 230, "type": "exterior" }],
  "openings": [{ "type": "pivot_door", "position": [1500,0], "width": 1000, "swing": "inward_90" }]
}
```

## ZWCAD DXF layers (AIA)

| Layer | ACI | Weight |
|---|---|---|
| `A-WALL-EXTR` | 7 white | 0.50 mm |
| `A-WALL-INTR` | 8 gray | 0.25 mm |
| `A-DOOR` | 1 red | 0.25 mm + swing arcs |
| `A-GLAZ` | 4 cyan | sill + pane vectors |
| `A-ANNO-TEXT` | 2 yellow | room names / areas |
| `A-ANNO-DIMS` | 3 green | architectural ticks |
