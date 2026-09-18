from __future__ import annotations

from xml.sax.saxutils import escape

from .massing import Solid, build_solids
from .models import Layout

MATERIALS = {
    "stucco": ("0.86 0.80 0.72", "0.12", "0.06"),
    "stone": ("0.55 0.50 0.44", "0.22", "0.18"),
    "wood": ("0.42 0.28 0.16", "0.08", "0.35"),
    "glass": ("0.55 0.78 0.82", "0.85", "0.02"),
    "metal": ("0.28 0.27 0.25", "0.55", "0.22"),
}


def build_collada(layout: Layout) -> bytes:
    solids = build_solids(layout)
    meshes: list[str] = []
    nodes: list[str] = []
    effects = []
    materials = []
    for key, (diffuse, spec, shin) in MATERIALS.items():
        transparent = key == "glass"
        effects.append(
            f"""
    <effect id="{key}-fx"><profile_COMMON><technique sid="t">
      <phong>
        <diffuse><color>{diffuse} {"0.35" if transparent else "1"}</color></diffuse>
        <specular><color>{spec} {spec} {spec} 1</color></specular>
        <shininess><float>{shin}</float></shininess>
        {"<transparency><float>0.35</float></transparency>" if transparent else ""}
      </phong>
    </technique></profile_COMMON></effect>"""
        )
        materials.append(
            f'<material id="{key}-mat" name="{key}"><instance_effect url="#{key}-fx"/></material>'
        )

    for index, solid in enumerate(solids):
        geom_id = f"solid-{index}"
        positions, normals, indices = _box(solid)
        meshes.append(_geometry(geom_id, positions, normals, indices))
        nodes.append(
            f'      <node id="node-{index}" name="{escape(solid.name)}">'
            f'<instance_geometry url="#{geom_id}">'
            f"<bind_material><technique_common>"
            f'<instance_material symbol="mat" target="#{solid.material}-mat"/>'
            f"</technique_common></bind_material>"
            f"</instance_geometry></node>"
        )

    dae = f"""<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor>
      <author>Cadence Studio</author>
      <authoring_tool>Cadence Studio</authoring_tool>
    </contributor>
    <unit name="meter" meter="1.0"/>
    <up_axis>Z_UP</up_axis>
  </asset>
  <library_effects>
{"".join(effects)}
  </library_effects>
  <library_materials>
{"".join(materials)}
  </library_materials>
  <library_geometries>
{"".join(meshes)}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="house" name="CadenceHouse">
{chr(10).join(nodes)}
    </visual_scene>
  </library_visual_scenes>
  <scene>
    <instance_visual_scene url="#house"/>
  </scene>
</COLLADA>
"""
    return dae.encode("utf-8")


def build_obj(layout: Layout) -> tuple[bytes, bytes]:
    solids = build_solids(layout)
    mtl_lines = ["# Cadence materials"]
    for key, (diffuse, spec, shin) in MATERIALS.items():
        rgb = diffuse.split()
        mtl_lines += [
            f"newmtl {key}",
            f"Kd {rgb[0]} {rgb[1]} {rgb[2]}",
            f"Ks {spec} {spec} {spec}",
            f"Ns {float(shin) * 200}",
            "d 0.38" if key == "glass" else "d 1.0",
            "",
        ]
    obj_lines = ["# Cadence house", "mtllib cadence-house.mtl"]
    v = 1
    for solid in solids:
        positions, _normals, indices = _box(solid)
        obj_lines.append(f"o {solid.name}")
        obj_lines.append(f"usemtl {solid.material}")
        verts = list(zip(positions[0::3], positions[1::3], positions[2::3]))
        unique: list[tuple[float, float, float]] = []
        remap: dict[int, int] = {}
        for i, vert in enumerate(verts):
            remap[i] = len(unique) + v
            unique.append(vert)
        for x, y, z in unique:
            obj_lines.append(f"v {x:.5f} {y:.5f} {z:.5f}")
        for i in range(0, len(indices), 3):
            a, b, c = indices[i : i + 3]
            obj_lines.append(f"f {remap[a]} {remap[b]} {remap[c]}")
        v += len(unique)
    return ("\n".join(obj_lines) + "\n").encode("utf-8"), ("\n".join(mtl_lines) + "\n").encode("utf-8")


def _box(solid: Solid) -> tuple[list[float], list[float], list[int]]:
    x0, y0, x1, y1, z0, z1 = solid.x0, solid.y0, solid.x1, solid.y1, solid.z0, solid.z1
    corners = [
        (x0, y0, z0),
        (x1, y0, z0),
        (x1, y1, z0),
        (x0, y1, z0),
        (x0, y0, z1),
        (x1, y0, z1),
        (x1, y1, z1),
        (x0, y1, z1),
    ]
    faces = [
        (0, 1, 2, 3, 0, 0, -1),
        (4, 7, 6, 5, 0, 0, 1),
        (0, 4, 5, 1, 0, -1, 0),
        (1, 5, 6, 2, 1, 0, 0),
        (2, 6, 7, 3, 0, 1, 0),
        (3, 7, 4, 0, -1, 0, 0),
    ]
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    cursor = 0
    for a, b, c, d, nx, ny, nz in faces:
        for i in (a, b, c, d):
            positions.extend(corners[i])
            normals.extend((nx, ny, nz))
        indices.extend((cursor, cursor + 1, cursor + 2, cursor, cursor + 2, cursor + 3))
        cursor += 4
    return positions, normals, indices


def _fmt(values: list[float]) -> str:
    return " ".join(f"{v:.5f}" for v in values)


def _geometry(geom_id: str, positions: list[float], normals: list[float], indices: list[int]) -> str:
    vcount = len(positions) // 3
    tri = len(indices) // 3
    p_list = " ".join(f"{i} {i}" for i in indices)
    return f"""
    <geometry id="{geom_id}" name="{geom_id}">
      <mesh>
        <source id="{geom_id}-pos">
          <float_array id="{geom_id}-pos-array" count="{len(positions)}">{_fmt(positions)}</float_array>
          <technique_common>
            <accessor source="#{geom_id}-pos-array" count="{vcount}" stride="3">
              <param name="X" type="float"/>
              <param name="Y" type="float"/>
              <param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <source id="{geom_id}-nrm">
          <float_array id="{geom_id}-nrm-array" count="{len(normals)}">{_fmt(normals)}</float_array>
          <technique_common>
            <accessor source="#{geom_id}-nrm-array" count="{vcount}" stride="3">
              <param name="X" type="float"/>
              <param name="Y" type="float"/>
              <param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="{geom_id}-vtx">
          <input semantic="POSITION" source="#{geom_id}-pos"/>
        </vertices>
        <triangles count="{tri}" material="mat">
          <input semantic="VERTEX" source="#{geom_id}-vtx" offset="0"/>
          <input semantic="NORMAL" source="#{geom_id}-nrm" offset="1"/>
          <p>{p_list}</p>
        </triangles>
      </mesh>
    </geometry>
"""
