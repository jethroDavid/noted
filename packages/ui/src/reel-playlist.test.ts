import { describe, expect, it } from "vitest";
import { getNextReelIndex } from "./reel-playlist";

const ready = (id: string) => ({ id, status: "ready", videoUrl: `${id}.mp4` });
describe("TV playlist", () => {
  it("skips unfinished uploads and wraps from the final clip", () => {
    const reels = [
      ready("a"),
      { id: "upload", status: "uploading", videoUrl: null },
      ready("b"),
    ];
    expect(getNextReelIndex(reels, "a")).toBe(2);
    expect(getNextReelIndex(reels, "b")).toBe(0);
  });
  it("repeats a single playable clip", () => {
    expect(getNextReelIndex([ready("a")], "a")).toBe(0);
  });
  it("does not advance to an empty or unavailable playlist", () => {
    expect(getNextReelIndex([], "a")).toBe(-1);
    expect(
      getNextReelIndex([{ id: "a", status: "ready", videoUrl: null }], "a"),
    ).toBe(-1);
  });
});
