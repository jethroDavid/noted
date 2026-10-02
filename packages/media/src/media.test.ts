import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { mediaEnv } from "./env";
import { extensionForContentType, isDeletableKey } from "./keys";
import {
  deleteUploadBlobs,
  ensureBucket,
  getObjectBytes,
  objectExists,
  presignGet,
  presignPut,
  putObjectBytes,
} from "./s3";
import { makePoster, makeThumbnail } from "./variants";

// Media tests run against real MinIO (local compose on 9000, or the S3_*
// CI sets for its service). Every test uses random keys and deletes them
// afterwards, so runs never touch dev data. Thumbnails generate their
// source with sharp; posters use the bundled reels, read the way
// packages/db/src/seed.ts reads them.
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../apps/web/public/fixtures",
);

function fixtureBytes(file: string): Buffer {
  return readFileSync(join(fixturesDir, file));
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

describe("media env", () => {
  it("resolves the configured bucket", () => {
    expect(mediaEnv().bucket.length).toBeGreaterThan(0);
  });
});

describe("object storage", () => {
  it("creates the bucket idempotently", async () => {
    await ensureBucket();
    await ensureBucket();
  });

  it("round-trips bytes through a presigned PUT and GET", async () => {
    const key = `homes/test-home/originals/${randomUUID()}.txt`;
    const contentType = "text/plain";
    const bytes = Buffer.from("presigned round-trip");
    try {
      const ticket = await presignPut(key, contentType, bytes.length);
      expect(ticket.key).toBe(key);
      // The ticket binds content type and size: the PUT must match the
      // approved values exactly (fetch sets content-length itself).
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: bytes,
      });
      expect(put.status).toBe(200);
      expect(await objectExists(key)).toBe(true);
      expect(await getObjectBytes(key)).toEqual(bytes);

      const getUrl = await presignGet(key);
      const get = await fetch(getUrl);
      expect(get.status).toBe(200);
      expect(Buffer.from(await get.arrayBuffer())).toEqual(bytes);
    } finally {
      await deleteUploadBlobs([key]);
    }
  });

  it("reports missing keys as absent", async () => {
    expect(
      await objectExists(`homes/test-home/originals/${randomUUID()}`),
    ).toBe(false);
  });

  it("deletes upload blobs but never fixture keys", async () => {
    const key = `homes/test-home/originals/${randomUUID()}.txt`;
    const bundled = "fixtures/reels/flower.mp4";
    await putObjectBytes(key, Buffer.from("cleanup me"), "text/plain");
    const outcome = await deleteUploadBlobs([key, bundled]);
    expect(outcome).toEqual({ deleted: [key], skipped: [bundled] });
    expect(await objectExists(key)).toBe(false);
  });
});

describe("variants", () => {
  it("makes a small JPEG thumbnail from a generated photo", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();
    const thumbnail = await makeThumbnail(source);
    expect(isJpeg(thumbnail.bytes)).toBe(true);
    expect(thumbnail.bytes.length).toBeLessThan(source.length);
    expect(thumbnail.width).toBeLessThanOrEqual(400);
    expect(thumbnail.height).toBeGreaterThan(0);
  });

  it("makes a JPEG poster from a fixture reel", async () => {
    const poster = await makePoster(fixtureBytes("reels/flower.mp4"));
    expect(isJpeg(poster)).toBe(true);
    expect(poster.length).toBeGreaterThan(0);
  });

  it("makes a poster from a moov-at-end phone recording", async () => {
    // Phone and screen recordings store moov at the END of the file, which
    // piped (non-seekable) ffmpeg cannot decode from. Remux the fixture
    // without faststart to reproduce that layout (default muxer behavior).
    if (!ffmpegPath) throw new Error("ffmpeg binary is missing.");
    const staged = join(tmpdir(), `noted-test-${randomUUID()}.mp4`);
    const remux = spawnSync(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      join(fixturesDir, "reels/flower.mp4"),
      "-c",
      "copy",
      staged,
    ]);
    expect(remux.status).toBe(0);
    try {
      const bytes = readFileSync(staged);
      // Self-validating: the regression input really has moov after mdat.
      expect(bytes.indexOf("mdat")).toBeGreaterThanOrEqual(0);
      expect(bytes.indexOf("moov")).toBeGreaterThan(bytes.indexOf("mdat"));
      const poster = await makePoster(bytes);
      expect(isJpeg(poster)).toBe(true);
      expect(poster.length).toBeGreaterThan(0);
    } finally {
      await rm(staged, { force: true });
    }
  });

  it("fails loudly on content that is not a video", async () => {
    await expect(makePoster(Buffer.from("not a video"))).rejects.toThrow();
  });
});

describe("keys", () => {
  it("maps allowed content types to extensions", () => {
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/png")).toBe("png");
    expect(extensionForContentType("image/webp")).toBe("webp");
    expect(extensionForContentType("video/mp4")).toBe("mp4");
    expect(extensionForContentType("video/webm")).toBe("webm");
  });

  it("rejects unknown content types so drift fails loudly", () => {
    expect(() => extensionForContentType("application/pdf")).toThrow(
      "Unsupported upload content type",
    );
  });

  it("treats only home keys as deletable", () => {
    expect(isDeletableKey("homes/abc/originals/x.jpg")).toBe(true);
    expect(isDeletableKey("fixtures/reels/flower.mp4")).toBe(false);
  });
});
