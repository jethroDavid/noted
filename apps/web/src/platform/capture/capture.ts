"use client";

import type { CameraPlugin, MediaResult } from "@capacitor/camera";
import { UPLOAD_RULES } from "@noted/validators/src";
import type { UploadKind } from "@noted/validators/src";

// The Camera plugin loads lazily: desktop bundles never pay for it, and no
// native JS evaluates during server rendering. Callers must gate on
// isNativeShell() — the plugin has no usable web implementation here.
interface CameraModule {
  Camera: CameraPlugin;
  MediaTypeSelection: { Photo: number; Video: number; All: number };
  CameraErrorCode: {
    TakePhotoCancelled: string;
    RecordVideoCancelled: string;
    ChooseMediaCancelled: string;
  };
}

async function loadCamera(): Promise<CameraModule> {
  return import("@capacitor/camera");
}

const FORMAT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

function isCancel(
  error: unknown,
  CameraErrorCode: CameraModule["CameraErrorCode"],
): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return (
      code === CameraErrorCode.TakePhotoCancelled ||
      code === CameraErrorCode.RecordVideoCancelled ||
      code === CameraErrorCode.ChooseMediaCancelled
    );
  }
  return error instanceof Error && /cancel|dismiss/i.test(error.message);
}

// Reads the captured bytes through the webPath the plugin serves locally,
// so uploads reuse the exact File flow (validate, ticket, PUT, confirm).
async function mediaToFile(
  result: MediaResult,
  kind: UploadKind,
  name: string,
  label: string,
): Promise<File> {
  const rules = UPLOAD_RULES[kind];
  const format = (result.metadata?.format ?? "").toLowerCase();
  const mime = FORMAT_MIME[format];
  if (!mime || !(rules.contentTypes as readonly string[]).includes(mime)) {
    throw new Error(
      `${label} is not a supported ${kind} (${rules.contentTypes.join(", ")}).`,
    );
  }
  const capMb = Math.round(rules.maxBytes / (1024 * 1024));
  if (
    result.metadata?.size !== undefined &&
    result.metadata.size > rules.maxBytes
  ) {
    throw new Error(`${label} exceeds the ${capMb}MB ${kind} cap.`);
  }
  if (!result.webPath) {
    throw new Error(`Could not read ${label}.`);
  }
  const response = await fetch(result.webPath);
  if (!response.ok) {
    throw new Error(`Could not read ${label}.`);
  }
  const blob = await response.blob();
  if (blob.size > rules.maxBytes) {
    throw new Error(`${label} exceeds the ${capMb}MB ${kind} cap.`);
  }
  return new File([blob], name, { type: mime });
}

async function runCapture<T>(
  permission: "camera" | "photos",
  action: (camera: CameraModule) => Promise<T | null>,
): Promise<T | null> {
  const camera = await loadCamera();
  const status = await camera.Camera.checkPermissions();
  if (status[permission] !== "granted" && status[permission] !== "limited") {
    const next = await camera.Camera.requestPermissions({
      permissions: [permission],
    });
    if (next[permission] !== "granted" && next[permission] !== "limited") {
      throw new Error(
        permission === "camera"
          ? "Camera access was denied. Allow it in Settings to take photos and clips."
          : "Gallery access was denied. Allow it in Settings to choose media.",
      );
    }
  }
  try {
    return await action(camera);
  } catch (error) {
    if (isCancel(error, camera.CameraErrorCode)) return null;
    throw error;
  }
}

/** Native camera shutter; null when the user backs out. */
export async function takePhoto(): Promise<File | null> {
  return runCapture("camera", async ({ Camera }) => {
    const result = await Camera.takePhoto({
      quality: 85,
      includeMetadata: true,
    });
    const format = result.metadata?.format ?? "jpg";
    return mediaToFile(
      result,
      "photo",
      `captured-photo.${format}`,
      "That photo",
    );
  });
}

/** Native gallery image picker (single); null when the user backs out. */
export async function pickGalleryPhoto(): Promise<File | null> {
  return runCapture("photos", async ({ Camera, MediaTypeSelection }) => {
    const picked = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      includeMetadata: true,
    });
    const [first] = picked.results;
    if (!first) return null;
    const format = first.metadata?.format ?? "jpg";
    return mediaToFile(first, "photo", `gallery-photo.${format}`, "That photo");
  });
}

/** Native video recording; null when the user backs out. */
export async function recordVideo(): Promise<File | null> {
  return runCapture("camera", async ({ Camera }) => {
    const result = await Camera.recordVideo({ includeMetadata: true });
    const format = result.metadata?.format ?? "mp4";
    return mediaToFile(result, "video", `recorded-clip.${format}`, "That clip");
  });
}

/** Native gallery video picker (single); null when the user backs out. */
export async function pickGalleryVideo(): Promise<File | null> {
  return runCapture("photos", async ({ Camera, MediaTypeSelection }) => {
    const picked = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Video,
      includeMetadata: true,
    });
    const [first] = picked.results;
    if (!first) return null;
    const format = first.metadata?.format ?? "mp4";
    return mediaToFile(first, "video", `gallery-clip.${format}`, "That clip");
  });
}
