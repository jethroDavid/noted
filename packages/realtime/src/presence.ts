import superjson from "superjson";
import { commands } from "./redis";

export interface PresenceViewer {
  userId: string;
  displayName: string | null;
  email: string;
}

// Refreshes land every 20s; a viewer missing three is gone. Key expiry
// (double the window) bounds garbage when a client never says bye.
const PRESENCE_WINDOW_MS = 60_000;
const PRESENCE_KEY_TTL_SECONDS = 120;

export function presenceLastSeenKey(boardId: string): string {
  return `board:presence:${boardId}:lastseen`;
}

export function presencePayloadsKey(boardId: string): string {
  return `board:presence:${boardId}:viewers`;
}

export async function refreshBoardPresence(
  boardId: string,
  viewer: PresenceViewer,
): Promise<void> {
  const lastSeenKey = presenceLastSeenKey(boardId);
  const payloadsKey = presencePayloadsKey(boardId);

  try {
    await Promise.all([
      commands.zadd(lastSeenKey, Date.now(), viewer.userId),
      commands.hset(payloadsKey, viewer.userId, superjson.stringify(viewer)),
      commands.expire(lastSeenKey, PRESENCE_KEY_TTL_SECONDS),
      commands.expire(payloadsKey, PRESENCE_KEY_TTL_SECONDS),
    ]);
  } catch (error) {
    // Fail-open like publishing: presence gaps heal on the next refresh.
    console.error("Skipping presence refresh during Redis outage:", error);
  }
}

export async function leaveBoardPresence(
  boardId: string,
  userId: string,
): Promise<void> {
  try {
    await Promise.all([
      commands.zrem(presenceLastSeenKey(boardId), userId),
      commands.hdel(presencePayloadsKey(boardId), userId),
    ]);
  } catch (error) {
    console.error("Skipping presence leave during Redis outage:", error);
  }
}

// Cheap liveness probe (one score read, no writes): lets callers publish
// only when the viewer set actually changes.
export async function isBoardViewerLive(
  boardId: string,
  userId: string,
): Promise<boolean> {
  try {
    const score = await commands.zscore(
      presenceLastSeenKey(boardId),
      userId,
    );
    return score !== null && Number(score) > Date.now() - PRESENCE_WINDOW_MS;
  } catch (error) {
    // Fail-open toward publishing: unknown reads as absent so callers keep
    // the old always-publish behavior during an outage.
    console.error("Reading presence liveness during Redis outage:", error);
    return false;
  }
}

// Prunes stale last-seen entries on every read, so viewers converge
// without keyspace notifications. Sorted by email for a deterministic UI
// and tests.
export async function listBoardViewers(
  boardId: string,
): Promise<PresenceViewer[]> {
  const lastSeenKey = presenceLastSeenKey(boardId);
  const payloadsKey = presencePayloadsKey(boardId);

  try {
    await commands.zremrangebyscore(
      lastSeenKey,
      0,
      Date.now() - PRESENCE_WINDOW_MS,
    );

    const [userIds, payloads] = await Promise.all([
      commands.zrange(lastSeenKey, "0", "-1"),
      commands.hgetall(payloadsKey),
    ]);

    await removeOrphanedPayloads(payloadsKey, userIds, payloads);

    return parseViewers(userIds, payloads);
  } catch (error) {
    // Fail-open like publishing: unknown viewers read as nobody home.
    console.error("Reading empty presence during Redis outage:", error);
    return [];
  }
}

async function removeOrphanedPayloads(
  payloadsKey: string,
  userIds: string[],
  payloads: Record<string, string>,
): Promise<void> {
  const live = new Set(userIds);
  const orphaned = Object.keys(payloads).filter((userId) => !live.has(userId));
  if (orphaned.length > 0) await commands.hdel(payloadsKey, ...orphaned);
}

function parseViewers(
  userIds: string[],
  payloads: Record<string, string>,
): PresenceViewer[] {
  const viewers: PresenceViewer[] = [];

  for (const userId of userIds) {
    const payload = payloads[userId];
    if (!payload) continue;
    try {
      viewers.push(superjson.parse<PresenceViewer>(payload));
    } catch {
      // A corrupt payload drops out on the next prune; skip it meanwhile.
    }
  }

  return viewers.sort((left, right) => left.email.localeCompare(right.email));
}
