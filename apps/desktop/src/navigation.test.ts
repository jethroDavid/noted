import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSignInNavigation, rendererAsset } from "./navigation.js";

describe("bundled desktop navigation", () => {
  const root = resolve("renderer");
  it("serves bundled assets and rejects alternate hosts, encoded traversal, and malformed paths", () => {
    expect(rendererAsset(root, "noted://app/assets/sqlite.wasm")).toContain(
      "sqlite.wasm",
    );
    for (const url of [
      "noted://other/index.html",
      "https://app/index.html",
      "noted://app/..%2fsecret",
      "noted://app/%ZZ",
    ])
      expect(rendererAsset(root, url)).toBeNull();
  });
  it("only opens the configured backend's sign-in page externally", () => {
    const apiUrl = "https://noted.example";
    expect(isSignInNavigation(`${apiUrl}/native-auth?id=test`, apiUrl)).toBe(
      true,
    );
    for (const url of [
      "file:///secret",
      "https://noted.example.evil.com/native-auth",
      `${apiUrl}/other`,
      "https://fake@noted.example/native-auth",
    ])
      expect(isSignInNavigation(url, apiUrl)).toBe(false);
  });
});
