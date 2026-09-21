import { describe, expect, it } from "vitest";
import { getPlantStage } from "./plant-growth";

describe("plant growth", () => {
  it.each([
    [0, "small"],
    [3, "small"],
    [4, "growing"],
    [7, "growing"],
    [8, "lush"],
    [11, "lush"],
    [12, "overgrown"],
    [100, "overgrown"],
  ] as const)("uses %s additions to select %s", (count, stage) => {
    expect(getPlantStage(count)).toBe(stage);
  });
});
