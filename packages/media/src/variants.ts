import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

export interface Thumbnail {
  bytes: Buffer;
  width: number;
  height: number;
}

// Board thumbnails: 400px wide JPEGs. Small enough for instant board
// loads, big enough for the fridge cards and the book grid.
export async function makeThumbnail(input: Buffer): Promise<Thumbnail> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

// Reel posters: one 720px-wide JPEG frame from half a second in. The
// upload is staged to a temp file (always unlinked) because phone and
// screen recordings store moov at the END of the file: ffmpeg consumes a
// non-seekable stdin pipe to find it, then cannot seek back to decode a
// frame. A seekable file also allows input seeking, which is faster than
// output seeking. Sub-second clips find no frame there and fail — the
// worker treats that as "no poster" and the reel still plays.
export async function makePoster(
  input: Buffer,
  extension = "mp4",
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is missing (ffmpeg-static install failed).");
  }
  const staged = join(tmpdir(), `noted-poster-${randomUUID()}.${extension}`);
  await writeFile(staged, input);
  try {
    const frame = await runFfmpeg(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0.5",
      "-i",
      staged,
      "-frames:v",
      "1",
      "-vf",
      "scale=720:-2",
      "-f",
      "mjpeg",
      "pipe:1",
    ]);
    if (frame.length === 0) {
      throw new Error("ffmpeg produced an empty poster frame.");
    }
    return frame;
  } finally {
    await rm(staged, { force: true });
  }
}

function runFfmpeg(ffmpeg: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, {
      timeout: 60_000,
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      const detail = Buffer.concat(errors).toString("utf8").slice(-500);
      reject(new Error(`ffmpeg exited with code ${code}: ${detail}`));
    });
  });
}
