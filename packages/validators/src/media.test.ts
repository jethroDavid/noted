import { describe, expect, it } from "vitest";
import {
  bookResponseSchema,
  mediaEventSchema,
  reelsResponseSchema,
  requestUploadSchema,
  UPLOAD_RULES,
} from "./index";

const HOME_ID = "123e4567-e89b-12d3-a456-426614174001";

describe("upload requests", () => {
  it("accepts a photo and a video within caps", () => {
    expect(
      requestUploadSchema.safeParse({
        homeId: HOME_ID,
        kind: "photo",
        contentType: "image/jpeg",
        byteSize: 1024,
      }).success,
    ).toBe(true);
    expect(
      requestUploadSchema.safeParse({
        homeId: HOME_ID,
        kind: "video",
        contentType: "video/mp4",
        byteSize: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects content types outside the kind allowlist", () => {
    const parsed = requestUploadSchema.safeParse({
      homeId: HOME_ID,
      kind: "photo",
      contentType: "video/mp4",
      byteSize: 1024,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects oversized and empty uploads", () => {
    expect(
      requestUploadSchema.safeParse({
        homeId: HOME_ID,
        kind: "photo",
        contentType: "image/jpeg",
        byteSize: UPLOAD_RULES.photo.maxBytes + 1,
      }).success,
    ).toBe(false);
    expect(
      requestUploadSchema.safeParse({
        homeId: HOME_ID,
        kind: "video",
        contentType: "video/mp4",
        byteSize: 0,
      }).success,
    ).toBe(false);
  });
});

describe("media payloads", () => {
  it("round-trips reels, book, and media events", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    expect(
      reelsResponseSchema.safeParse({
        reels: [
          {
            id: "123e4567-e89b-12d3-a456-426614174000",
            homeId: HOME_ID,
            status: "ready",
            videoUrl: "https://example.test/video.mp4",
            posterUrl: null,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      reelsResponseSchema.safeParse({
        reels: [
          {
            id: "123e4567-e89b-12d3-a456-426614174000",
            homeId: HOME_ID,
            status: "ready",
            videoUrl: "https://example.test/video.mp4",
            posterUrl: "https://example.test/poster.jpg",
            createdAt: now,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      reelsResponseSchema.safeParse({
        reels: [
          {
            id: "123e4567-e89b-12d3-a456-426614174000",
            homeId: HOME_ID,
            status: "uploading",
            videoUrl: null,
            posterUrl: null,
            createdAt: now,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      bookResponseSchema.safeParse({
        entries: [
          {
            id: "123e4567-e89b-12d3-a456-426614174002",
            thumbnailUrl: "https://example.test/thumb.jpg",
            imageUrl: "https://example.test/full.jpg",
            archivedAt: now,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      mediaEventSchema.safeParse({
        type: "media-changed",
        homeId: HOME_ID,
      }).success,
    ).toBe(true);
  });
});
