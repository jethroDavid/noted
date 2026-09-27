import { describe, expect, it } from "vitest";
import { boardEventSchema } from "./index";

const boardId = "11111111-1111-4111-8111-111111111111";

describe("board events", () => {
  it("parses a board-changed event", () => {
    expect(boardEventSchema.parse({ type: "board-changed", boardId })).toEqual({
      type: "board-changed",
      boardId,
    });
  });

  it("parses a presence event with viewers", () => {
    const viewers = [
      {
        userId: "22222222-2222-4222-8222-222222222222",
        displayName: "Ada",
        email: "ada@example.test",
      },
      {
        userId: "33333333-3333-4333-8333-333333333333",
        displayName: null,
        email: "grace@example.test",
      },
    ];
    expect(
      boardEventSchema.parse({ type: "presence", boardId, viewers }),
    ).toEqual({ type: "presence", boardId, viewers });
  });

  it("rejects an unknown event type", () => {
    expect(() =>
      boardEventSchema.parse({ type: "board-shouted", boardId }),
    ).toThrow();
  });

  it("rejects a malformed board id", () => {
    expect(() =>
      boardEventSchema.parse({ type: "board-changed", boardId: "nope" }),
    ).toThrow();
  });
});
