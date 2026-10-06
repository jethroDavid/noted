import { afterEach, describe, expect, it } from "vitest";
import { isNativeShell } from "./device";

function setWindow(value: unknown): void {
  (globalThis as Record<string, unknown>).window = value;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("isNativeShell", () => {
  it("returns false without a window (SSR)", () => {
    expect(isNativeShell()).toBe(false);
  });

  it("returns false on plain web", () => {
    setWindow({});
    expect(isNativeShell()).toBe(false);
  });

  it("returns false when the bridge reports web", () => {
    setWindow({ Capacitor: { isNativePlatform: () => false } });
    expect(isNativeShell()).toBe(false);
  });

  it("returns true inside the native webview", () => {
    setWindow({ Capacitor: { isNativePlatform: () => true } });
    expect(isNativeShell()).toBe(true);
  });
});
