import type { BoardPost } from "@noted/contracts";
import { describe, expect, it } from "vitest";
import { toClientPost } from "./use-fridge-posts-source";

function boardPost(overrides?: Partial<BoardPost>): BoardPost {
  return {
    id: "post-1",
    boardId: "board-1",
    kind: "text",
    text: "Server note",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:05:00.000Z",
    deletionRequestedAt: null,
    deleteAfter: null,
    ...overrides,
  };
}

describe("board post mapping", () => {
  it("carries content, colors, and position onto the client post", () => {
    expect(toClientPost(boardPost(), 2)).toEqual({
      id: "post-1",
      kind: "text",
      text: "Server note",
      x: 0.3,
      y: 0.4,
      background: "#f5dfa0",
      foreground: "#33352e",
      order: 2,
      removedAt: null,
    });
  });

  it("marks pending removal with the server request time", () => {
    const post = toClientPost(
      boardPost({
        deletionRequestedAt: "2026-09-21T11:00:00.000Z",
        deleteAfter: "2026-09-21T12:00:00.000Z",
      }),
      0,
    );
    expect(post.removedAt).toBe(Date.parse("2026-09-21T11:00:00.000Z"));
  });
});
