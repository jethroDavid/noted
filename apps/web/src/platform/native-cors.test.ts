import { afterEach, describe, expect, it, vi } from "vitest";
import { nativeCorsHeaders } from "./native-cors";

afterEach(() => vi.unstubAllEnvs());
describe("native API origins", () => {
  it("allows the bundled app origins without accepting lookalikes or null origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const origin of [
      "https://localhost",
      "capacitor://localhost",
      "noted://app",
    ]) {
      expect(nativeCorsHeaders(origin).get("access-control-allow-origin")).toBe(
        origin,
      );
    }
    for (const origin of [
      null,
      "null",
      "https://localhost.evil.com",
      "noted://other",
      "http://localhost:5173",
    ]) {
      expect(nativeCorsHeaders(origin).has("access-control-allow-origin")).toBe(
        false,
      );
    }
  });
  it("allows local preview origins only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      nativeCorsHeaders("http://localhost:5173").get(
        "access-control-allow-origin",
      ),
    ).toBe("http://localhost:5173");
    expect(
      nativeCorsHeaders("http://localhost").get("access-control-allow-origin"),
    ).toBe("http://localhost");
  });
});
