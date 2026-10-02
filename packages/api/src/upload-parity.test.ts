import { extensionForContentType } from "@noted/media/src";
import { UPLOAD_RULES } from "@noted/validators/src";
import { describe, expect, it } from "vitest";

// The media leaf mirrors the validators upload allowlist for key
// extensions (it cannot import that sibling); the two lists stay in sync
// through this test.
describe("upload allowlist parity", () => {
  it("maps every allowed content type to an extension", () => {
    const kinds = Object.keys(UPLOAD_RULES) as Array<keyof typeof UPLOAD_RULES>;
    expect(kinds).toEqual(["photo", "video"]);
    for (const kind of kinds) {
      for (const contentType of UPLOAD_RULES[kind].contentTypes) {
        expect(() => extensionForContentType(contentType)).not.toThrow();
      }
    }
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("video/mp4")).toBe("mp4");
  });
});
