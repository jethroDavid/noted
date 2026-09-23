import { describe, expect, it } from "vitest";
import { boardPostsKey, fridgePostsPrefix } from "./posts-keys";

describe("fridge-posts query keys", () => {
  it("scopes the board entry by account, home, and board", () => {
    expect(boardPostsKey("account-1", "home-1", "board-1")).toEqual([
      "fridge-posts",
      "board",
      "account-1",
      "home-1",
      "board-1",
    ]);
  });

  it("gives each account and home its own cache entries", () => {
    expect(boardPostsKey("account-1", "home-1", "board-1")).not.toEqual(
      boardPostsKey("account-2", "home-1", "board-1"),
    );
    expect(boardPostsKey("account-1", "home-1", "board-1")).not.toEqual(
      boardPostsKey("account-1", "home-2", "board-2"),
    );
  });

  it("shares one prefix so sign-out can clear every posts entry", () => {
    expect(fridgePostsPrefix).toEqual(["fridge-posts"]);
    expect(boardPostsKey("account-1", "home-1", "board-1").slice(0, 1)).toEqual(
      [...fridgePostsPrefix],
    );
  });
});
