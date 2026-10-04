import { describe, expect, it } from "vitest";
import { createMemoryFrameClock } from "./memory-frame-clock";

describe("memory frame pacing", () => {
  for (const refreshRate of [60, 90, 120]) {
    for (const fps of [24, 30]) {
      it(`keeps ${fps}fps on a ${refreshRate}Hz display`, () => {
        const clock = createMemoryFrameClock();
        const frames: number[] = [];
        for (let i = 0; i < refreshRate * 10; i++) {
          const time = clock(1000 / refreshRate, fps);
          if (time !== null) frames.push(time);
        }
        expect(frames).toHaveLength(fps * 10);
        expect(frames.at(-1)).toBeCloseTo(10);
      });
    }
  }

  it("advances motion through skipped frames", () => {
    const clock = createMemoryFrameClock();
    expect(clock(20, 30)).toBeNull();
    expect(clock(20, 30)).toBeCloseTo(0.04);
    expect(clock(20, 30)).toBeNull();
    expect(clock(20, 30)).toBeCloseTo(0.08);
  });

  it("caps a long pause without queuing a burst of frames", () => {
    const clock = createMemoryFrameClock();
    expect(clock(5000, 30)).toBeCloseTo(0.1);
    expect(clock(0, 30)).toBeNull();
    expect(clock(1000 / 30, 30)).toBeCloseTo(0.1 + 1 / 30);
  });
});
