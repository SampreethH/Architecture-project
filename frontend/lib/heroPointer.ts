import type { PointerEvent } from "react";
import { Vector2 } from "three";

export const heroPointer = new Vector2();

export function bindHeroPointer(event: PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  heroPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  heroPointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
}
