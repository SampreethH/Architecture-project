from __future__ import annotations

from dataclasses import dataclass

from .models import Detail, Layout, Opening, Wall

STOREY_M = 3.15
SILL_M = 0.9
HEAD_M = 2.15
ROOF_M = 0.42
OVERHANG_M = 0.55


@dataclass
class Solid:
    x0: float
    y0: float
    x1: float
    y1: float
    z0: float
    z1: float
    material: str
    name: str


def build_solids(layout: Layout) -> list[Solid]:
    solids: list[Solid] = []
    xs: list[float] = []
    ys: list[float] = []
    for room in layout.rooms:
        for x, y in room.bounds:
            xs.append(x / 1000.0)
            ys.append(y / 1000.0)
    if not xs:
        return solids

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    solids.append(
        Solid(min_x - 0.08, min_y - 0.08, max_x + 0.08, max_y + 0.08, 0.0, 0.12, "wood", "Floor")
    )
    solids.append(
        Solid(
            min_x - 2.4,
            min_y - 2.4,
            max_x + 2.4,
            max_y + 2.4,
            -0.08,
            0.0,
            "stone",
            "Site",
        )
    )

    for index, wall in enumerate(layout.walls):
        solids.extend(_wall_solids(wall, layout.openings, index))

    for index, opening in enumerate(layout.openings):
        solids.extend(_opening_solids(opening, index))

    roof_z0 = STOREY_M
    solids.append(
        Solid(
            min_x - OVERHANG_M,
            min_y - OVERHANG_M,
            max_x + OVERHANG_M,
            max_y + OVERHANG_M,
            roof_z0,
            roof_z0 + ROOF_M,
            "metal",
            "Roof",
        )
    )
    # parapet
    t = 0.12
    z0, z1 = roof_z0 + ROOF_M, roof_z0 + ROOF_M + 0.38
    rx0, ry0 = min_x - OVERHANG_M, min_y - OVERHANG_M
    rx1, ry1 = max_x + OVERHANG_M, max_y + OVERHANG_M
    solids.append(Solid(rx0, ry0, rx1, ry0 + t, z0, z1, "stucco", "Parapet"))
    solids.append(Solid(rx0, ry1 - t, rx1, ry1, z0, z1, "stucco", "Parapet"))
    solids.append(Solid(rx0, ry0, rx0 + t, ry1, z0, z1, "stucco", "Parapet"))
    solids.append(Solid(rx1 - t, ry0, rx1, ry1, z0, z1, "stucco", "Parapet"))

    for index, detail in enumerate(layout.details):
        solids.extend(_detail_solids(detail, index))

    return [s for s in solids if s.x1 - s.x0 > 0.03 and s.y1 - s.y0 > 0.03 and s.z1 - s.z0 > 0.02]


def _wall_solids(wall: Wall, openings: list[Opening], index: int) -> list[Solid]:
    x0, y0 = wall.start[0] / 1000.0, wall.start[1] / 1000.0
    x1, y1 = wall.end[0] / 1000.0, wall.end[1] / 1000.0
    dx, dy = x1 - x0, y1 - y0
    length = (dx * dx + dy * dy) ** 0.5
    if length < 0.2:
        return []
    ux, uy = dx / length, dy / length
    t = max(0.08, wall.thickness / 1000.0)
    nx, ny = -uy * t / 2, ux * t / 2
    material = "stone" if wall.type == "exterior" else "stucco"

    cuts: list[tuple[float, float, Opening]] = []
    for opening in openings:
        px, py = opening.position[0] / 1000.0, opening.position[1] / 1000.0
        relx, rely = px - x0, py - y0
        along = relx * ux + rely * uy
        perp = abs(relx * nx * 2 / t + rely * ny * 2 / t) if t else 99
        # distance to infinite line
        dist = abs(-uy * relx + ux * rely)
        if dist > t * 1.6 + 0.12:
            continue
        half = opening.width / 2000.0
        a = along
        lo, hi = a, a + opening.width / 1000.0
        if hi < 0.05 or lo > length - 0.05:
            continue
        cuts.append((max(0.0, lo), min(length, hi), opening))

    cuts.sort(key=lambda c: c[0])
    merged: list[tuple[float, float, Opening]] = []
    for cut in cuts:
        if merged and cut[0] <= merged[-1][1] + 0.02:
            prev = merged[-1]
            merged[-1] = (prev[0], max(prev[1], cut[1]), prev[2])
        else:
            merged.append(cut)

    solids: list[Solid] = []
    cursor = 0.0
    for lo, hi, opening in merged:
        if lo - cursor > 0.08:
            solids.append(_segment(x0, y0, ux, uy, nx, ny, cursor, lo, 0.0, STOREY_M, material, f"Wall-{index}"))
        is_window = opening.type in {"window", "casement"}
        if is_window:
            solids.append(_segment(x0, y0, ux, uy, nx, ny, lo, hi, 0.0, SILL_M, material, f"Sill-{index}"))
            solids.append(_segment(x0, y0, ux, uy, nx, ny, lo, hi, HEAD_M, STOREY_M, material, f"Lintel-{index}"))
        else:
            solids.append(_segment(x0, y0, ux, uy, nx, ny, lo, hi, HEAD_M, STOREY_M, material, f"Lintel-{index}"))
        cursor = hi
    if length - cursor > 0.08:
        solids.append(_segment(x0, y0, ux, uy, nx, ny, cursor, length, 0.0, STOREY_M, material, f"Wall-{index}"))
    if not merged:
        solids.append(_segment(x0, y0, ux, uy, nx, ny, 0.0, length, 0.0, STOREY_M, material, f"Wall-{index}"))
    return solids


def _segment(
    x0: float,
    y0: float,
    ux: float,
    uy: float,
    nx: float,
    ny: float,
    a: float,
    b: float,
    z0: float,
    z1: float,
    material: str,
    name: str,
) -> Solid:
    p0x, p0y = x0 + ux * a, y0 + uy * a
    p1x, p1y = x0 + ux * b, y0 + uy * b
    xs = [p0x + nx, p0x - nx, p1x + nx, p1x - nx]
    ys = [p0y + ny, p0y - ny, p1y + ny, p1y - ny]
    return Solid(min(xs), min(ys), max(xs), max(ys), z0, z1, material, name)


def _opening_solids(opening: Opening, index: int) -> list[Solid]:
    px, py = opening.position[0] / 1000.0, opening.position[1] / 1000.0
    dx, dy = opening.direction[0], opening.direction[1]
    length = (dx * dx + dy * dy) ** 0.5 or 1.0
    ux, uy = dx / length, dy / length
    w = opening.width / 1000.0
    nx, ny = -uy * 0.04, ux * 0.04
    x0, y0 = px, py
    x1, y1 = px + ux * w, py + uy * w
    xs = [x0 + nx, x0 - nx, x1 + nx, x1 - nx]
    ys = [y0 + ny, y0 - ny, y1 + ny, y1 - ny]
    if opening.type in {"window", "casement"}:
        return [
            Solid(min(xs), min(ys), max(xs), max(ys), SILL_M + 0.04, HEAD_M - 0.04, "glass", f"Glass-{index}")
        ]
    # door leaf
    leaf_w = 0.045
    lx = [x0, x0 + ux * 0.04, x0 + ux * 0.04 + -uy * 0.85, x0 + -uy * 0.85]
    ly = [y0, y0 + uy * 0.04, y0 + uy * 0.04 + ux * 0.85, y0 + ux * 0.85]
    return [
        Solid(min(lx) - leaf_w, min(ly) - leaf_w, max(lx) + leaf_w, max(ly) + leaf_w, 0.0, HEAD_M - 0.05, "wood", f"Door-{index}")
    ]


def _detail_solids(detail: Detail, index: int) -> list[Solid]:
    if len(detail.path) < 2:
        return []
    a, b = detail.path[0], detail.path[-1]
    x0, y0 = a[0] / 1000.0, a[1] / 1000.0
    x1, y1 = b[0] / 1000.0, b[1] / 1000.0
    h = detail.height_mm / 1000.0
    sill = detail.sill_mm / 1000.0
    t = max(0.05, detail.thickness_mm / 1000.0)
    material = {
        "glazing": "glass",
        "millwork": "wood",
        "furniture": "wood",
        "partition": "stucco",
        "stair": "stone",
    }.get(detail.kind, "stucco")
    if detail.kind in {"furniture", "millwork"} and abs(x1 - x0) > 0.15 and abs(y1 - y0) > 0.15:
        return [Solid(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1), sill, sill + h, material, f"{detail.kind}-{index}")]
    dx, dy = x1 - x0, y1 - y0
    length = (dx * dx + dy * dy) ** 0.5 or 0.2
    ux, uy = dx / length, dy / length
    nx, ny = -uy * t / 2, ux * t / 2
    return [_segment(x0, y0, ux, uy, nx, ny, 0.0, length, sill, sill + h, material, f"{detail.kind}-{index}")]
