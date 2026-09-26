import { describe, expect, it } from "vitest";
import {
  clampNormalizedCoordinate,
  getRemovalDeadline,
  PHOTO_FIXTURES,
  photoFixtureImageUrl,
  photoFixtureStorageKey,
  REMOVAL_RECOVERY_MS,
} from "./index";

describe("removal window", () => {
  it("spans one hour", () => {
    expect(REMOVAL_RECOVERY_MS).toBe(3_600_000);
  });

  it("anchors the deadline to the request time", () => {
    const requestedAt = new Date("2026-09-26T10:00:00.000Z");
    expect(getRemovalDeadline(requestedAt)).toEqual(
      new Date("2026-09-26T11:00:00.000Z"),
    );
  });
});

describe("clampNormalizedCoordinate", () => {
  it("clamps outside values into 0..1", () => {
    expect(clampNormalizedCoordinate(-0.5)).toBe(0);
    expect(clampNormalizedCoordinate(1.5)).toBe(1);
    expect(clampNormalizedCoordinate(0.25)).toBe(0.25);
  });

  it("rejects non-finite values", () => {
    expect(() => clampNormalizedCoordinate(Number.NaN)).toThrow(TypeError);
    expect(() => clampNormalizedCoordinate(Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
  });
});

describe("photo fixtures", () => {
  it("resolves storage keys and public urls", () => {
    expect(PHOTO_FIXTURES.map((fixture) => fixture.key)).toEqual([
      "lake",
      "living-room",
      "moonlit-bedroom",
    ]);
    expect(photoFixtureStorageKey("lake")).toBe("fixtures/lake.jpg");
    expect(photoFixtureImageUrl("lake")).toBe("/fixtures/lake.jpg");
  });

  it("rejects unknown keys", () => {
    expect(() => photoFixtureStorageKey("nope")).toThrow(
      "Unknown photo fixture: nope",
    );
  });
});
