import { and, count, eq, lte, sql } from "drizzle-orm";

import { database } from "./client";
import { posts } from "./schema";

function expiredTextPosts() {
  return and(eq(posts.kind, "text"), lte(posts.deleteAfter, sql`now()`));
}

/** Physical cleanup for expired text posts. Media-aware cleanup arrives with Phase 6. */
export async function pruneExpiredTextPosts(): Promise<number> {
  const removed = await database
    .delete(posts)
    .where(expiredTextPosts())
    .returning({ id: posts.id });
  return removed.length;
}

export async function countExpiredTextPosts(): Promise<number> {
  const [row] = await database
    .select({ value: count() })
    .from(posts)
    .where(expiredTextPosts());
  return row?.value ?? 0;
}
