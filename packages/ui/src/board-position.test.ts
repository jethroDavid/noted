import { describe, expect, it } from "vitest";
import { clampBoardPostPosition } from "./board-position";

describe("fridge card containment", () => {
  const surface = { width: 300, height: 500 };
  const photo = { width: 120, height: 180 };

  it.each([
    { x: -1, y: -1 },
    { x: 2, y: 2 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ])(
    "keeps every card edge and magnet inside the surface at $x, $y",
    (position) => {
      const result = clampBoardPostPosition(position, surface, photo);
      expect(result.x * surface.width - photo.width / 2).toBeGreaterThanOrEqual(
        6,
      );
      expect(result.x * surface.width + photo.width / 2).toBeLessThanOrEqual(
        surface.width - 6,
      );
      expect(
        result.y * surface.height - photo.height / 2 - 8,
      ).toBeGreaterThanOrEqual(6);
      expect(result.y * surface.height + photo.height / 2).toBeLessThanOrEqual(
        surface.height - 6,
      );
    },
  );

  it("leaves an interior position unchanged", () => {
    expect(clampBoardPostPosition({ x: 0.4, y: 0.6 }, surface, photo)).toEqual({
      x: 0.4,
      y: 0.6,
    });
  });

  it("recalculates edge clearance when the phone or loaded image size changes", () => {
    const position = { x: 0.9, y: 0.1 };
    const large = clampBoardPostPosition(position, surface, photo);
    const small = clampBoardPostPosition(
      position,
      { width: 180, height: 300 },
      { width: 90, height: 200 },
    );
    expect(small.x).toBeLessThan(large.x);
    expect(small.y).toBeGreaterThan(large.y);
  });

  it("centers an oversized card or an unmeasured surface without invalid coordinates", () => {
    expect(
      clampBoardPostPosition({ x: 0, y: 1 }, { width: 0, height: 0 }, photo),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      clampBoardPostPosition({ x: 0, y: 1 }, { width: 50, height: 50 }, photo),
    ).toEqual({ x: 0.5, y: 0.5 });
  });
});
