import { expect, test } from "vitest";
import {
  boardPostsResponseSchema,
  createPostSchema,
  hexColorSchema,
  inviteMemberSchema,
  normalizedCoordinateSchema,
  postTextSchema,
  updatePostContentSchema,
  updatePostPositionSchema,
} from "./index";

test("normalizes a pasted invitation address before validating it", () => {
  expect(inviteMemberSchema.parse({ email: "  Alice@Example.com  " })).toEqual({
    email: "alice@example.com",
  });
  expect(inviteMemberSchema.safeParse({ email: "not an email" }).success).toBe(
    false,
  );
});

test("trims note text and enforces the shared length limit", () => {
  expect(postTextSchema.parse("  hello  ")).toBe("hello");
  expect(postTextSchema.safeParse("   ").success).toBe(false);
  expect(postTextSchema.safeParse("x".repeat(2000)).success).toBe(true);
  expect(postTextSchema.safeParse("x".repeat(2001)).success).toBe(false);
});

test("accepts six-digit hex colors only", () => {
  expect(hexColorSchema.safeParse("#f5dfa0").success).toBe(true);
  for (const bad of ["f5dfa0", "#f5dfa", "#f5dfa00", "red", ""]) {
    expect(hexColorSchema.safeParse(bad).success).toBe(false);
  }
});

test("accepts finite normalized coordinates only", () => {
  expect(normalizedCoordinateSchema.safeParse(0).success).toBe(true);
  expect(normalizedCoordinateSchema.safeParse(1).success).toBe(true);
  expect(normalizedCoordinateSchema.safeParse(0.5).success).toBe(true);
  for (const bad of [-0.1, 1.1, Number.NaN, Infinity, -Infinity]) {
    expect(normalizedCoordinateSchema.safeParse(bad).success).toBe(false);
  }
});

test("splits content and position payloads so drags cannot carry text", () => {
  const content = {
    text: "Sunday dinner",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
  };
  expect(updatePostContentSchema.parse(content)).toEqual(content);
  expect(updatePostPositionSchema.parse({ x: 0.25, y: 0.75 })).toEqual({
    x: 0.25,
    y: 0.75,
  });
  expect(updatePostContentSchema.parse({ ...content, x: 0.5 })).toEqual(
    content,
  );
  expect(
    updatePostPositionSchema.parse({ x: 0.5, y: 0.6, text: "hi" }),
  ).toEqual({
    x: 0.5,
    y: 0.6,
  });
  expect(createPostSchema.parse({ ...content, x: 0.5, y: 0.6 })).toMatchObject(
    content,
  );
});

test("parses a board response with server time and removal deadlines", () => {
  const post = {
    id: "00000000-0000-4000-8000-000000000001",
    boardId: "00000000-0000-4000-8000-000000000002",
    kind: "text",
    text: "Oat milk",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:05:00.000Z",
    deletionRequestedAt: null,
    deleteAfter: null,
  };
  const parsed = boardPostsResponseSchema.parse({
    board: {
      id: post.boardId,
      homeId: "00000000-0000-4000-8000-000000000003",
      postAdditions: 4,
    },
    posts: [
      post,
      {
        ...post,
        id: "00000000-0000-4000-8000-000000000004",
        deletionRequestedAt: "2026-09-21T11:00:00.000Z",
        deleteAfter: "2026-09-21T12:00:00.000Z",
      },
    ],
    serverTime: "2026-09-21T11:30:00.000Z",
  });
  expect(parsed.posts).toHaveLength(2);
  expect(parsed.posts[1].deleteAfter).toBe("2026-09-21T12:00:00.000Z");
});
