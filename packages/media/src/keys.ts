import "server-only";

export function originalKey(
  homeId: string,
  assetId: string,
  extension: string,
): string {
  return `homes/${homeId}/originals/${assetId}.${extension}`;
}

export function thumbnailKey(homeId: string, assetId: string): string {
  return `homes/${homeId}/thumbs/${assetId}.jpg`;
}

export function posterKey(homeId: string, assetId: string): string {
  return `homes/${homeId}/posters/${assetId}.jpg`;
}

// Only home-upload keys are ever deleted. Fixture blobs (fixtures/...) are
// shared public app assets — the cleanup path must never touch them.
export function isDeletableKey(key: string): boolean {
  return key.startsWith("homes/");
}

// Mirrors the validators upload allowlist (this leaf cannot import it);
// unknown types throw so a validator/media drift fails loudly at upload.
export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    default:
      throw new Error(`Unsupported upload content type: ${contentType}`);
  }
}
