import { describe, expect, it } from "vitest";
import { PRODUCTION_URL, resolveStartUrl } from "./start-url.js";

describe("resolveStartUrl", () => {
  it("loads the local dev server by default in development", () => {
    expect(resolveStartUrl({ packaged: false })).toBe("http://localhost:3000");
  });

  it("respects PORT in development", () => {
    expect(resolveStartUrl({ packaged: false, port: "3001" })).toBe(
      "http://localhost:3001",
    );
  });

  it("prefers APP_URL over the local default in development", () => {
    expect(
      resolveStartUrl({
        packaged: false,
        appUrl: "https://staging.example.com",
        port: "3001",
      }),
    ).toBe("https://staging.example.com");
  });

  it("ignores an empty APP_URL in development", () => {
    expect(resolveStartUrl({ packaged: false, appUrl: "" })).toBe(
      "http://localhost:3000",
    );
  });

  it("always loads production when packaged", () => {
    expect(
      resolveStartUrl({
        packaged: true,
        appUrl: "https://staging.example.com",
        port: "3001",
      }),
    ).toBe(PRODUCTION_URL);
  });
});
