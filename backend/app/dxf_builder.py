from __future__ import annotations

import math
from io import StringIO

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

from .models import Detail, Layout, Opening, Wall

LAYERS = {
    "A-WALL-EXTR": {"color": 7, "lineweight": 50},
    "A-WALL-INTR": {"color": 8, "lineweight": 25},
    "A-DOOR": {"color": 1, "lineweight": 25},
    "A-GLAZ": {"color": 4, "lineweight": 18},
    "A-ANNO-TEXT": {"color": 2, "lineweight": 13},
    "A-ANNO-DIMS": {"color": 3, "lineweight": 13},
    "A-FURN": {"color": 30, "lineweight": 18},
    "A-SKETCH-INK": {"color": 40, "lineweight": 13},
    "A-SKETCH-ANNO": {"color": 2, "lineweight": 13},
    "A-SKETCH-3D": {"color": 6, "lineweight": 25},
}


def build_dxf(layout: Layout) -> bytes:
    doc = ezdxf.new("R2018", setup=True)
    doc.units = units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    doc.header["$LWDISPLAY"] = 1

    for name, spec in LAYERS.items():
        if name in doc.layers:
            layer = doc.layers.get(name)
            layer.color = spec["color"]
            layer.dxf.lineweight = spec["lineweight"]
        else:
            doc.layers.add(
                name,
                color=spec["color"],
                lineweight=spec["lineweight"],
            )

    style = doc.styles.get("Standard")
    style.dxf.font = "Arial.ttf"

    if "CADENCE" not in doc.dimstyles:
        dim = doc.dimstyles.duplicate_entry("EZDXF", "CADENCE")
        dim.dxf.dimtxt = 220
        dim.dxf.dimasz = 180
        dim.dxf.dimexe = 120
        dim.dxf.dimexo = 80
        dim.dxf.dimclrd = 3
        dim.dxf.dimclre = 3
        dim.dxf.dimclrt = 3
        dim.dxf.dimlwd = 13
        dim.dxf.dimlwe = 13
        dim.dxf.dimblk = "ARCHTICK"
        dim.dxf.dimblk1 = "ARCHTICK"
        dim.dxf.dimblk2 = "ARCHTICK"
        dim.dxf.dimdec = 0
        dim.dxf.dimzin = 8
        dim.dxf.dimlfac = 0.001
        dim.dxf.dimpost = '<>m'

    msp = doc.modelspace()

    for wall in layout.walls:
        _draw_wall(msp, wall)

    for opening in layout.openings:
        _draw_opening(msp, opening)

    for detail in layout.details:
        _draw_detail(msp, detail)

    for room in layout.rooms:
        cx = sum(p[0] for p in room.bounds) / len(room.bounds)
        cy = sum(p[1] for p in room.bounds) / len(room.bounds)
        msp.add_text(
            room.name.upper(),
            dxfattribs={
                "layer": "A-ANNO-TEXT",
                "height": 220,
                "style": "Standard",
            },
        ).set_placement((cx, cy + 180), align=TextEntityAlignment.MIDDLE_CENTER)
        msp.add_text(
            f"{room.area_sqm:.1f} SQ.M",
            dxfattribs={
                "layer": "A-ANNO-TEXT",
                "height": 150,
                "style": "Standard",
            },
        ).set_placement((cx, cy - 160), align=TextEntityAlignment.MIDDLE_CENTER)

    _draw_dimensions(msp, layout)
    _title_block(msp, layout)

    buffer = StringIO()
    doc.write(buffer)
    return buffer.getvalue().encode("utf-8")


def _offset_poly(wall: Wall) -> list[tuple[float, float]]:
    x1, y1 = wall.start
    x2, y2 = wall.end
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length
    h = wall.thickness / 2.0
    return [
        (x1 + nx * h, y1 + ny * h),
        (x2 + nx * h, y2 + ny * h),
        (x2 - nx * h, y2 - ny * h),
        (x1 - nx * h, y1 - ny * h),
    ]


def _draw_wall(msp, wall: Wall) -> None:
    layer = "A-WALL-EXTR" if wall.type == "exterior" else "A-WALL-INTR"
    msp.add_lwpolyline(
        _offset_poly(wall),
        close=True,
        dxfattribs={"layer": layer, "lineweight": LAYERS[layer]["lineweight"]},
    )


def _unit(vec: tuple[float, float]) -> tuple[float, float]:
    mag = math.hypot(vec[0], vec[1]) or 1.0
    return vec[0] / mag, vec[1] / mag


def _draw_opening(msp, opening: Opening) -> None:
    ux, uy = _unit(opening.direction)
    nx, ny = _unit(opening.inward)
    x, y = opening.position
    w = opening.width
    leaf = (x + ux * w, y + uy * w)

    if opening.type in {"window", "casement"}:
        inset = 90
        msp.add_lwpolyline(
            [
                (x + nx * inset, y + ny * inset),
                (leaf[0] + nx * inset, leaf[1] + ny * inset),
                (leaf[0] - nx * inset, leaf[1] - ny * inset),
                (x - nx * inset, y - ny * inset),
            ],
            close=True,
            dxfattribs={"layer": "A-GLAZ"},
        )
        msp.add_line(
            (x, y),
            leaf,
            dxfattribs={"layer": "A-GLAZ"},
        )
        msp.add_line(
            (x + nx * inset * 0.4, y + ny * inset * 0.4),
            (leaf[0] + nx * inset * 0.4, leaf[1] + ny * inset * 0.4),
            dxfattribs={"layer": "A-GLAZ"},
        )
        return

    msp.add_line((x, y), leaf, dxfattribs={"layer": "A-DOOR"})
    if opening.type == "sliding_door":
        msp.add_line(
            (x + nx * 80, y + ny * 80),
            (leaf[0] + nx * 80, leaf[1] + ny * 80),
            dxfattribs={"layer": "A-DOOR"},
        )
        return

    if opening.swing == "none":
        return

    sign = 1.0 if opening.swing == "inward_90" else -1.0
    if opening.swing == "inward_90":
        start = math.degrees(math.atan2(uy, ux))
        end = math.degrees(math.atan2(ny, nx))
    else:
        start = math.degrees(math.atan2(-ny, -nx))
        end = math.degrees(math.atan2(uy, ux))

    msp.add_line(
        (x, y),
        (x + nx * w * sign, y + ny * w * sign),
        dxfattribs={"layer": "A-DOOR"},
    )
    msp.add_arc(
        center=(x, y),
        radius=w,
        start_angle=min(start, end),
        end_angle=max(start, end),
        dxfattribs={"layer": "A-DOOR"},
    )


def _draw_detail(msp, detail: Detail) -> None:
    if len(detail.path) < 2:
        return
    a, b = detail.path[0], detail.path[-1]
    layer = "A-GLAZ" if detail.kind == "glazing" else "A-FURN" if detail.kind in {"millwork", "furniture", "stair"} else "A-WALL-INTR"
    if detail.kind in {"furniture", "millwork"} and abs(a[0] - b[0]) > 200 and abs(a[1] - b[1]) > 200:
        x0, x1 = min(a[0], b[0]), max(a[0], b[0])
        y0, y1 = min(a[1], b[1]), max(a[1], b[1])
        msp.add_lwpolyline(
            [(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
            close=True,
            dxfattribs={"layer": layer},
        )
        return
    msp.add_line(a, b, dxfattribs={"layer": layer})


def _draw_dimensions(msp, layout: Layout) -> None:
    xs = [p[0] for room in layout.rooms for p in room.bounds]
    ys = [p[1] for room in layout.rooms for p in room.bounds]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    dim_x = msp.add_linear_dim(
        base=(min_x, min_y - 900),
        p1=(min_x, min_y),
        p2=(max_x, min_y),
        dimstyle="CADENCE",
        dxfattribs={"layer": "A-ANNO-DIMS"},
    )
    dim_x.render()

    dim_y = msp.add_linear_dim(
        base=(min_x - 900, min_y),
        p1=(min_x, min_y),
        p2=(min_x, max_y),
        angle=90,
        dimstyle="CADENCE",
        dxfattribs={"layer": "A-ANNO-DIMS"},
    )
    dim_y.render()

    living = next((r for r in layout.rooms if "Living" in r.name), None)
    if living:
        x0, y0 = living.bounds[0]
        x1 = max(p[0] for p in living.bounds)
        dim = msp.add_linear_dim(
            base=(x0, y0 - 450),
            p1=(x0, y0),
            p2=(x1, y0),
            dimstyle="CADENCE",
            dxfattribs={"layer": "A-ANNO-DIMS"},
        )
        dim.render()


def _title_block(msp, layout: Layout) -> None:
    xs = [p[0] for room in layout.rooms for p in room.bounds] or [0]
    ys = [p[1] for room in layout.rooms for p in room.bounds] or [0]
    x = min(xs)
    y = min(ys) - 2200
    msp.add_lwpolyline(
        [(x, y), (x + 7200, y), (x + 7200, y + 1100), (x, y + 1100)],
        close=True,
        dxfattribs={"layer": "A-ANNO-TEXT"},
    )
    msp.add_text(
        "CADENCE STUDIO  /  ZWCAD 2D  /  AIA LAYERS",
        dxfattribs={"layer": "A-ANNO-TEXT", "height": 140},
    ).set_placement((x + 180, y + 760), align=TextEntityAlignment.LEFT)
    msp.add_text(
        f"SCALE {layout.metadata.scale}    UNITS {layout.metadata.unit}    CARPET {layout.metadata.total_area_sqm:.2f} SQ.M",
        dxfattribs={"layer": "A-ANNO-TEXT", "height": 120},
    ).set_placement((x + 180, y + 480), align=TextEntityAlignment.LEFT)
    msp.add_text(
        layout.metadata.brief.upper()[:92],
        dxfattribs={"layer": "A-ANNO-TEXT", "height": 110},
    ).set_placement((x + 180, y + 220), align=TextEntityAlignment.LEFT)
