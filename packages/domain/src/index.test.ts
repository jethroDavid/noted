import { describe, expect, it } from "vitest";

import {
  REMOVAL_RECOVERY_MS,
  clampNormalizedCoordinate,
  getRemovalDeadline,
} from "./index";

describe("removal recovery", () => {
  it("sets the agreed one-hour recovery deadline", () => {
    const requestedAt = new Date("2026-09-16T00:00:00.000Z");

    expect(REMOVAL_RECOVERY_MS).toBe(3_600_000);
    expect(getRemovalDeadline(requestedAt).toISOString()).toBe(
      "2026-09-16T01:00:00.000Z",
    );
  });
});

describe("board coordinates", () => {
  it.each([
    [-0.2, 0],
    [0.4, 0.4],
    [1.2, 1],
  ])("clamps %s to %s", (input, expected) => {
    expect(clampNormalizedCoordinate(input)).toBe(expected);
  });

  it("rejects invalid coordinates", () => {
    expect(() => clampNormalizedCoordinate(Number.NaN)).toThrow(TypeError);
  });
});
