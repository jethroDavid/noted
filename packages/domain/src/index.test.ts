import { describe, expect, it } from "vitest";
import { clampNormalizedCoordinate, mediaDisplayStatus } from "./index";

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

describe("mediaDisplayStatus", () => {
  it("maps the upload pipeline to display states", () => {
    const original = "homes/h/originals/a.jpg";
    expect(
      mediaDisplayStatus({
        state: "pending",
        storageKey: original,
        variantKey: null,
      }),
    ).toBe("uploading");
    expect(
      mediaDisplayStatus({
        state: "attached",
        storageKey: original,
        variantKey: null,
      }),
    ).toBe("processing");
    expect(
      mediaDisplayStatus({
        state: "attached",
        storageKey: original,
        variantKey: "homes/h/thumbs/a.jpg",
      }),
    ).toBe("ready");
  });

  it("treats the posterless-reel marker as ready", () => {
    // handleProcessMedia records poster failure as an empty key: any
    // non-null variant reads as ready, and the reel plays without a poster.
    expect(
      mediaDisplayStatus({
        state: "attached",
        storageKey: "homes/h/originals/a.mp4",
        variantKey: "",
      }),
    ).toBe("ready");
  });

  it("treats attached bundled keys as ready without variants", () => {
    expect(
      mediaDisplayStatus({
        state: "attached",
        storageKey: "fixtures/reels/bunny-360.mp4",
        variantKey: null,
      }),
    ).toBe("ready");
  });
});
