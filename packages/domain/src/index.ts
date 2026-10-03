export function clampNormalizedCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("A board coordinate must be a finite number.");
  }

  return Math.min(1, Math.max(0, value));
}

// Display state for an upload-backed asset, shared by photo posts (variant
// = thumbnailKey) and reels (variant = posterKey). Bundled keys skip
// processing: their originals serve every size, so an attached one is ready.
export type MediaDisplayStatus = "uploading" | "processing" | "ready";

export function mediaDisplayStatus(asset: {
  state: string;
  storageKey: string;
  variantKey: string | null;
}): MediaDisplayStatus {
  if (asset.state !== "attached") return "uploading";
  if (asset.variantKey !== null) return "ready";
  if (asset.storageKey.startsWith("fixtures/")) return "ready";
  return "processing";
}

// How long a reel stays on the TV feed before the sweep archives it to
// the photobook. One constant so the API, the worker, and the UI countdown
// all agree on the window.
export const REEL_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function reelExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + REEL_LIFETIME_MS);
}

export function isReelExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() >= reelExpiresAt(createdAt).getTime();
}

// Whole days until a reel leaves the TV feed, for the countdown label.
// Partial days round up (anything left today reads as 1); past expiry
// clamps to 0.
export function daysUntilReelExpiry(expiresAt: Date, now: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs));
}
