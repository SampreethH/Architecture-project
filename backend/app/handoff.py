from __future__ import annotations

import json
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from .dxf_builder import build_dxf
from .models import Layout
from .sketchup_builder import build_collada, build_obj

RUBY = r'''# Double-click in SketchUp, or Window → Ruby Console → load this file.
# It imports the house next to this script and saves a native .skp
require 'json'
require 'sketchup.rb'

module CadenceAtelier
  extend self
  def run
    dir = File.dirname(__FILE__)
    dae = File.join(dir, 'Cadence-House.dae')
    unless File.exist?(dae)
      dae = UI.openpanel('Cadence house (Collada)', dir, 'Collada|*.dae||')
      return unless dae
    end
    model = Sketchup.active_model
    model.start_operation('Cadence import', true)
    model.import(dae)
    json = dae.sub(/\.dae$/i, '.json')
    if File.exist?(json)
      data = JSON.parse(File.read(json))
      (data['views'] || []).each do |view|
        eye = Geom::Point3d.new(*view['position'].map { |n| n.to_f.m })
        target = Geom::Point3d.new(*view['target'].map { |n| n.to_f.m })
        page = model.pages.add(view['name'].to_s)
        page.camera.set(eye, target, Z_AXIS)
      end
    end
    model.commit_operation
    skp = File.join(File.dirname(dae), 'Cadence-House.skp')
    model.save(skp)
    UI.messagebox("Saved native SketchUp file:\n#{skp}\nOpen that .skp from now on.")
  end
end

CadenceAtelier.run
'''

README_SKP = """CADENCE → SKETCHUP

You asked for a .skp. Trimble does not let websites write a native SketchUp binary,
so this pack gives you a finished 3D house AND a one-click save to .skp.

FASTEST (opens in SketchUp now):
1. Unzip this folder.
2. Open SketchUp.
3. File → Import → Cadence-House.dae
   Units: Metres. Make sure “Merge coplanar faces” is on if you see it.
4. File → Save As → Cadence-House.skp

ONE-CLICK .SKP:
1. Unzip.
2. In SketchUp: Window → Ruby Console
3. load '/full/path/to/Save-as-SKP.rb'
   It writes Cadence-House.skp next to the DAE.

Cadence-House.obj also opens in SketchUp, Blender, Rhino, and 3ds Max.
"""

README_DWG = """CADENCE → AUTOCAD / ZWCAD
1. Open Cadence-Plan.dxf (R2018).
2. SAVEAS → AutoCAD Drawing (*.dwg) if you need DWG.

DXF is what AutoCAD, ZWCAD, DraftSight, and BricsCAD all open immediately.
"""

KML = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>Cadence House</name>
    <Model>
      <altitudeMode>relativeToGround</altitudeMode>
      <Location><longitude>0</longitude><latitude>0</latitude><altitude>0</altitude></Location>
      <Orientation><heading>0</heading><tilt>0</tilt><roll>0</roll></Orientation>
      <Scale><x>1</x><y>1</y><z>1</z></Scale>
      <Link><href>models/Cadence-House.dae</href></Link>
    </Model>
  </Placemark>
</kml>
"""


def sketchup_pack(layout: Layout) -> bytes:
    buf = BytesIO()
    dae = build_collada(layout)
    obj, mtl = build_obj(layout)
    payload = layout.model_dump()
    with ZipFile(buf, "w", ZIP_DEFLATED) as zf:
        zf.writestr("Cadence-House.dae", dae)
        zf.writestr("Cadence-House.obj", obj)
        zf.writestr("cadence-house.mtl", mtl)
        zf.writestr("Cadence-House.json", json.dumps(payload, indent=2))
        zf.writestr("Save-as-SKP.rb", RUBY)
        zf.writestr("HOW-TO-GET-SKP.txt", README_SKP)
    return buf.getvalue()


def sketchup_kmz(layout: Layout) -> bytes:
    buf = BytesIO()
    with ZipFile(buf, "w", ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", KML)
        zf.writestr("models/Cadence-House.dae", build_collada(layout))
    return buf.getvalue()


def zwcad_pack(layout: Layout) -> bytes:
    buf = BytesIO()
    dxf = build_dxf(layout)
    with ZipFile(buf, "w", ZIP_DEFLATED) as zf:
        zf.writestr("Cadence-Plan.dxf", dxf)
        zf.writestr("SAVEAS-DWG.txt", README_DWG)
        zf.writestr(
            "Cadence-SaveAs-DWG.scr",
            "._OPEN\nCadence-Plan.dxf\n._SAVEAS\n2013\nCadence-Plan.dwg\n",
        )
    return buf.getvalue()
