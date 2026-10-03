"use client";

type Point = { x: number; y: number };

export function getSceneSwipeStep(start: Point, end: Point): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 120 || Math.abs(dx) < Math.abs(dy) * 1.4) return 0;
  return dx < 0 ? 1 : -1;
}

export function getAdjacentSceneIndex(
  index: number,
  step: -1 | 1,
  count: number,
) {
  return (index + step + count) % count;
}
