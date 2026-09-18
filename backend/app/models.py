from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Point = tuple[float, float]


class Room(BaseModel):
    name: str
    bounds: list[Point]
    area_sqm: float


class Wall(BaseModel):
    start: Point
    end: Point
    thickness: float = 230
    type: Literal["exterior", "interior"] = "exterior"


class Opening(BaseModel):
    type: Literal["pivot_door", "sliding_door", "window", "casement"]
    position: Point
    width: float
    swing: Literal["none", "inward_90", "outward_90"] = "none"
    direction: Point = (1.0, 0.0)
    inward: Point = (0.0, 1.0)


class LayoutMetadata(BaseModel):
    unit: Literal["mm"] = "mm"
    scale: str = "1:100"
    total_area_sqm: float
    plot_length_mm: float = 18000
    plot_width_mm: float = 12000
    setback_mm: float = 1500
    facing: str = "north"
    brief: str = ""


class Detail(BaseModel):
    id: str = "detail"
    kind: Literal["partition", "millwork", "glazing", "furniture", "stair"] = "partition"
    path: list[Point]
    height_mm: float = 2700
    thickness_mm: float = 100
    sill_mm: float = 0


class SavedView(BaseModel):
    id: str
    name: str
    position: tuple[float, float, float] = (11, 7.5, 12)
    target: tuple[float, float, float] = (0, 1.2, 0)
    approval: Literal["draft", "submitted", "approved", "baked"] = "draft"
    stamps: list[str] = Field(default_factory=list)


class InkStroke(BaseModel):
    id: str
    points: list[Point]
    view_id: str | None = None
    viewId: str = "view-1"
    color: str = "#E8D5A3"


class HandLabel(BaseModel):
    id: str
    view_id: str | None = None
    viewId: str = "view-1"
    position: Point
    text: str
    handwritten: bool = True


class Layout(BaseModel):
    metadata: LayoutMetadata
    rooms: list[Room]
    walls: list[Wall]
    openings: list[Opening] = Field(default_factory=list)
    details: list[Detail] = Field(default_factory=list)
    views: list[SavedView] = Field(default_factory=list)
    ink: list[InkStroke] = Field(default_factory=list)
    labels: list[HandLabel] = Field(default_factory=list)


class Constraints(BaseModel):
    prompt: str = "1500 sq ft, 3 BHK, North-facing entry, open kitchen, master suite with walk-in closet"
    plot_length_m: float = 18
    plot_width_m: float = 12
    setback_m: float = 1.5
    target_carpet_sqm: float = 139.35
    bhk: int = 3
    north_facing: bool = True
    open_kitchen: bool = True
    master_walk_in: bool = True
