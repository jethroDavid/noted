"use client";

// Keep the remainder so display refresh rates do not silently lower our frame rate.
export function createMemoryFrameClock() {
  let carry = 0;
  let elapsed = 0;
  return (deltaMs: number, fps: number): number | null => {
    const delta = Math.max(0, Math.min(deltaMs, 100));
    elapsed += delta / 1000;
    carry += delta;
    const interval = 1000 / fps;
    if (carry + 1e-6 < interval) return null;
    carry = Math.max(
      0,
      carry - Math.floor((carry + 1e-6) / interval) * interval,
    );
    return elapsed;
  };
}
