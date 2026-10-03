import { describe, expect, it } from "vitest";
import { getAdjacentSceneIndex, getSceneSwipeStep } from "./scene-swipe";

describe("scene gestures", () => {
  it.each([
    [0, 0, 0],
    [25, 3, 0],
    [20, 120, 0],
    [75, 90, 0],
    [-90, 12, 1],
    [90, -12, -1],
  ] as const)("movement (%i, %i) produces step %i", (x, y, step) => {
    expect(
      getSceneSwipeStep({ x: 100, y: 100 }, { x: 100 + x, y: 100 + y }),
    ).toBe(step);
  });

  it("wraps between the television and photobook in both directions", () => {
    expect(getAdjacentSceneIndex(2, 1, 3)).toBe(0);
    expect(getAdjacentSceneIndex(0, -1, 3)).toBe(2);
    expect(getAdjacentSceneIndex(0, 1, 3)).toBe(1);
  });
});
