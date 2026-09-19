import { describe, expect, it } from "vitest";
import { REMOVAL_RECOVERY_MS } from "@noted/domain";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  POST_SIZES,
  clampPosition,
  fixturePosts,
  isExpired,
  positionFromDrag,
  postLayer,
  removalMinutes,
} from "./board";

describe("fridge coordinates", () => {
  it.each(["text", "photo", "voice"] as const)(
    "keeps the entire %s card within the surface",
    (kind) => {
      const size = POST_SIZES[kind];
      expect(clampPosition({ x: -2, y: 8 }, kind)).toEqual({
        x: size.width / BOARD_WIDTH / 2,
        y: 1 - size.height / BOARD_HEIGHT / 2,
      });
    },
  );
  it("produces identical normalized moves on phone and desktop", () => {
    const start = { x: 0.4, y: 0.4 };
    expect(
      positionFromDrag(
        start,
        { x: 24, y: 29 },
        { width: 240, height: 290 },
        "text",
      ),
    ).toEqual(
      positionFromDrag(
        start,
        { x: 48, y: 58 },
        { width: 480, height: 580 },
        "text",
      ),
    );
  });
  it("temporarily raises selection without mutating creation order", () => {
    const post = { ...fixturePosts[0]! };
    expect(postLayer(post, post.id, 12)).toBe(14);
    expect(postLayer(post, null, 12)).toBe(1);
    expect(post.order).toBe(0);
  });
});

describe("temporary removal", () => {
  const post = { ...fixturePosts[0]!, removedAt: 1000 };
  it("preserves Undo up to, but not at, exactly one hour", () => {
    expect(isExpired(post, 1000 + REMOVAL_RECOVERY_MS - 1)).toBe(false);
    expect(isExpired(post, 1000 + REMOVAL_RECOVERY_MS)).toBe(true);
    expect(removalMinutes(post, 1000)).toBe(60);
    expect(removalMinutes(post, 1000 + REMOVAL_RECOVERY_MS)).toBe(0);
  });
  it("never expires a restored post", () => {
    expect(
      isExpired({ ...post, removedAt: null }, Number.MAX_SAFE_INTEGER),
    ).toBe(false);
  });
});
