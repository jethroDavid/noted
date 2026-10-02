import "server-only";
import superjson from "superjson";
import { commands } from "./redis";

// Board reads cache briefly: mutation events invalidate, so the TTL only
// bounds staleness when an invalidation is lost (a Redis blip).
const BOARD_CACHE_TTL_SECONDS = 60;

export function boardCacheKey(boardId: string): string {
  return `board:cache:${boardId}`;
}

// Values cross the boundary as unknown; the api layer validates them with
// zod, so this leaf never imports the validators sibling.
export async function readBoardCache(boardId: string): Promise<unknown | null> {
  let cached: string | null;
  try {
    cached = await commands.get(boardCacheKey(boardId));
  } catch (error) {
    // Fail-open like publishing: a Redis outage reads through to Postgres.
    console.error("Reading through board cache during Redis outage:", error);
    return null;
  }
  if (!cached) return null;
  try {
    return superjson.parse(cached);
  } catch (error) {
    console.error("Dropping unparseable board cache entry:", error);
    return null;
  }
}

export async function writeBoardCache(
  boardId: string,
  board: unknown,
): Promise<void> {
  try {
    await commands.set(
      boardCacheKey(boardId),
      superjson.stringify(board),
      "EX",
      BOARD_CACHE_TTL_SECONDS,
    );
  } catch (error) {
    console.error("Skipping board cache write during Redis outage:", error);
  }
}

export async function invalidateBoardCache(boardId: string): Promise<void> {
  try {
    await commands.del(boardCacheKey(boardId));
  } catch (error) {
    console.error(
      "Skipping board cache invalidation during Redis outage:",
      error,
    );
  }
}
