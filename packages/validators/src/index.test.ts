import { describe, expect, it } from "vitest";
import {
  boardPostSchema,
  createPhotoPostSchema,
  createTextPostSchema,
  helloInput,
  hexColorSchema,
  inviteEmailSchema,
  normalizedCoordinateSchema,
  photoFixtureKeySchema,
  postTextSchema,
  updatePostContentSchema,
  updatePostPositionSchema,
} from "./index";

describe("helloInput", () => {
  it("accepts an empty object", () => {
    expect(helloInput.parse({})).toEqual({});
  });

  it("accepts a name", () => {
    expect(helloInput.parse({ name: "Ada" })).toEqual({ name: "Ada" });
  });

  it("rejects an empty name", () => {
    expect(helloInput.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("inviteEmailSchema", () => {
  it("normalizes to lowercase", () => {
    expect(inviteEmailSchema.parse("Ada@Example.com")).toBe("ada@example.com");
  });

  it("rejects non-emails", () => {
    expect(inviteEmailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("postTextSchema", () => {
  it("trims and rejects blanks", () => {
    expect(postTextSchema.parse("  hi  ")).toBe("hi");
    expect(postTextSchema.safeParse("   ").success).toBe(false);
    expect(postTextSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
});

describe("hexColorSchema", () => {
  it("accepts six-digit hex", () => {
    expect(hexColorSchema.parse("#f5dfa0")).toBe("#f5dfa0");
  });

  it("rejects anything else", () => {
    for (const value of ["f5dfa0", "#fff", "#gggggg", "red"]) {
      expect(hexColorSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("normalizedCoordinateSchema", () => {
  it("accepts 0..1", () => {
    expect(normalizedCoordinateSchema.parse(0)).toBe(0);
    expect(normalizedCoordinateSchema.parse(1)).toBe(1);
  });

  it("rejects out-of-range and non-finite values", () => {
    for (const value of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(normalizedCoordinateSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("photoFixtureKeySchema", () => {
  it("accepts the bundled fixtures", () => {
    for (const key of ["lake", "living-room", "moonlit-bedroom"]) {
      expect(photoFixtureKeySchema.parse(key)).toBe(key);
    }
  });

  it("rejects unknown keys", () => {
    expect(photoFixtureKeySchema.safeParse("lake.jpg").success).toBe(false);
  });
});

describe("createTextPostSchema", () => {
  it("accepts a full note", () => {
    expect(
      createTextPostSchema.parse({
        text: "Milk",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
        x: 0.5,
        y: 0.5,
      }),
    ).toEqual({
      text: "Milk",
      foregroundColor: "#33352e",
      backgroundColor: "#f5dfa0",
      x: 0.5,
      y: 0.5,
    });
  });
});

describe("createPhotoPostSchema", () => {
  it("accepts a fixture plus position", () => {
    expect(
      createPhotoPostSchema.parse({ fixture: "lake", x: 0.5, y: 0.5 }),
    ).toEqual({ fixture: "lake", x: 0.5, y: 0.5 });
  });
});

describe("updatePostContentSchema", () => {
  it("requires text and both colors", () => {
    expect(updatePostContentSchema.safeParse({ text: "hi" }).success).toBe(
      false,
    );
  });
});

describe("updatePostPositionSchema", () => {
  it("requires both coordinates", () => {
    expect(updatePostPositionSchema.safeParse({ x: 0.5 }).success).toBe(false);
  });
});

describe("boardPostSchema", () => {
  it("discriminates text and photo posts", () => {
    const stamp = new Date("2026-09-26T10:00:00.000Z");
    const text = boardPostSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      boardId: "00000000-0000-4000-8000-000000000002",
      kind: "text",
      text: "hi",
      foregroundColor: "#33352e",
      backgroundColor: "#f5dfa0",
      x: 0.5,
      y: 0.5,
      createdAt: stamp,
      updatedAt: stamp,
      deletionRequestedAt: null,
      deleteAfter: null,
    });
    expect(text.kind).toBe("text");
    const photo = boardPostSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      boardId: "00000000-0000-4000-8000-000000000002",
      kind: "photo",
      imageUrl: "/fixtures/lake.jpg",
      x: 0.5,
      y: 0.5,
      createdAt: stamp,
      updatedAt: stamp,
    });
    expect(photo.kind).toBe("photo");
    expect(boardPostSchema.safeParse({ kind: "voice" }).success).toBe(false);
  });
});
