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
