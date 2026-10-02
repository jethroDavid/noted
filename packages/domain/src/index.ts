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
