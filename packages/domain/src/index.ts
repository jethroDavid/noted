export const REMOVAL_RECOVERY_MS = 60 * 60 * 1_000;

export function getRemovalDeadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + REMOVAL_RECOVERY_MS);
}

export function clampNormalizedCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("A board coordinate must be a finite number.");
  }

  return Math.min(1, Math.max(0, value));
}

export interface PhotoFixture {
  key: string;
  file: string;
  label: string;
  contentType: string;
  byteSize: number;
}

// Canonical bundled-fridge-photo catalog (Phase 1; uploads land in Phase 3).
// Files live in apps/web/public/fixtures. Validators mirrors the keys as a
// zod enum (it cannot import this leaf's sibling); an api test guards parity.
// Byte sizes are the measured fixture files; re-measure if a file changes.
export const PHOTO_FIXTURES = [
  {
    key: "lake",
    file: "lake.jpg",
    label: "Lake",
    contentType: "image/jpeg",
    byteSize: 206545,
  },
  {
    key: "living-room",
    file: "living-room.png",
    label: "Living room",
    contentType: "image/png",
    byteSize: 2403693,
  },
  {
    key: "moonlit-bedroom",
    file: "moonlit-bedroom.png",
    label: "Moonlit bedroom",
    contentType: "image/png",
    byteSize: 2368022,
  },
] as const satisfies readonly PhotoFixture[];

export type PhotoFixtureKey = (typeof PHOTO_FIXTURES)[number]["key"];

export function photoFixtureStorageKey(key: string): string {
  const fixture = PHOTO_FIXTURES.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`Unknown photo fixture: ${key}`);
  return `fixtures/${fixture.file}`;
}

export function photoFixtureImageUrl(key: string): string {
  return `/${photoFixtureStorageKey(key)}`;
}
