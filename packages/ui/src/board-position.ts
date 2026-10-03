"use client";

export interface BoardSize {
  width: number;
  height: number;
}

// Positions describe card centers. Leave room for the whole card, its
// eight-pixel magnet overhang, and a small gap from the painted door edge.
export function clampBoardPostPosition(
  position: { x: number; y: number },
  surface: BoardSize,
  card: BoardSize,
): { x: number; y: number } {
  function axis(value: number, length: number, size: number, overhang = 0) {
    if (length <= 0) return 0.5;
    const min = (size / 2 + 6 + overhang) / length;
    const max = 1 - (size / 2 + 6) / length;
    if (min > max) return 0.5;
    return Math.min(max, Math.max(min, value));
  }
  return {
    x: axis(position.x, surface.width, card.width),
    y: axis(position.y, surface.height, card.height, 8),
  };
}
