import "server-only";
import {
  bookEntries,
  db,
  homeMemberships,
  mediaAssets,
  mediaWork,
  posts,
  reels,
} from "@noted/db/src";
import { publishJob } from "@noted/queue/src";
import {
  and,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function recordMediaWork(
  tx: Transaction,
  input: {
    homeId: string;
    assetId: string;
    kind: "process-media" | "cleanup-media";
    keys?: string[];
    availableAt?: Date;
  },
) {
  await tx
    .insert(mediaWork)
    .values({
      id: `${input.kind}:${input.assetId}${input.kind === "cleanup-media" ? `:${(input.availableAt ?? new Date()).toISOString()}` : ""}`,
      homeId: input.homeId,
      assetId: input.assetId,
      kind: input.kind,
      keys: input.keys ?? [],
      availableAt: input.availableAt ?? new Date(),
    })
    .onConflictDoNothing();
}

// Completion, not publication, closes intent. Lost publications, worker crashes,
// duplicate deliveries and queue outages all leave recoverable work behind.
export async function dispatchMediaWork(
  database: typeof db = db,
  publish: typeof publishJob = publishJob,
) {
  const now = new Date();
  const rows = await database
    .select()
    .from(mediaWork)
    .where(and(isNull(mediaWork.completedAt), lte(mediaWork.availableAt, now)))
    .limit(50);
  for (const row of rows) {
    const [claimed] = await database
      .update(mediaWork)
      .set({
        attempts: sql`${mediaWork.attempts} + 1`,
        availableAt: new Date(
          now.getTime() +
            Math.min(3600_000, 30_000 * 2 ** Math.min(row.attempts, 7)),
        ),
      })
      .where(
        and(
          eq(mediaWork.id, row.id),
          eq(mediaWork.availableAt, row.availableAt),
          isNull(mediaWork.completedAt),
        ),
      )
      .returning();
    if (!claimed) continue;
    try {
      const result = await publish(
        row.kind === "process-media"
          ? {
              job: "process-media",
              homeId: row.homeId,
              assetId: row.assetId,
              workId: row.id,
            }
          : {
              job: "cleanup-media",
              homeId: row.homeId,
              assetId: row.assetId,
              keys: row.keys,
              workId: row.id,
            },
      );
      await database
        .update(mediaWork)
        .set({ lastError: result.delivered ? null : "QUEUE_UNAVAILABLE" })
        .where(eq(mediaWork.id, row.id));
    } catch {
      await database
        .update(mediaWork)
        .set({ lastError: "QUEUE_CONFIGURATION" })
        .where(eq(mediaWork.id, row.id));
    }
  }
  return { dispatched: rows.length };
}

export async function completeMediaWork(
  kind: string,
  assetId: string,
  workId?: string,
  database: typeof db = db,
) {
  await database
    .update(mediaWork)
    .set({ completedAt: new Date(), lastError: null })
    .where(
      and(
        eq(mediaWork.id, workId ?? `${kind}:${assetId}`),
        eq(mediaWork.assetId, assetId),
        eq(mediaWork.kind, kind),
      ),
    );
}

export async function reconcileMediaWork(
  database: typeof db = db,
  publish: typeof publishJob = publishJob,
) {
  const old = new Date(Date.now() - 24 * 3600_000);
  const candidates = await database
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.state, "pending"),
        or(
          and(
            lte(mediaAssets.createdAt, old),
            or(
              isNull(mediaAssets.uploadChecksum),
              and(
                notExists(
                  database
                    .select({ id: posts.id })
                    .from(posts)
                    .where(
                      and(
                        eq(posts.mediaAssetId, mediaAssets.id),
                        isNull(posts.deletedAt),
                      ),
                    ),
                ),
                notExists(
                  database
                    .select({ id: reels.id })
                    .from(reels)
                    .where(
                      and(
                        eq(reels.mediaAssetId, mediaAssets.id),
                        isNull(reels.deletedAt),
                      ),
                    ),
                ),
                notExists(
                  database
                    .select({ id: bookEntries.id })
                    .from(bookEntries)
                    .where(
                      and(
                        eq(bookEntries.mediaAssetId, mediaAssets.id),
                        isNull(bookEntries.deletedAt),
                      ),
                    ),
                ),
              ),
            ),
          ),
          and(
            isNotNull(mediaAssets.uploaderUserId),
            notExists(
              database
                .select({ userId: homeMemberships.userId })
                .from(homeMemberships)
                .where(
                  and(
                    eq(homeMemberships.homeId, mediaAssets.homeId),
                    eq(homeMemberships.userId, mediaAssets.uploaderUserId),
                  ),
                ),
            ),
          ),
        ),
        isNull(mediaAssets.cleanupAfter),
      ),
    )
    .limit(100);
  for (const candidate of candidates)
    await database.transaction(async (tx) => {
      const [asset] = await tx
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, candidate.id))
        .for("update");
      if (!asset || asset.state !== "pending" || asset.cleanupAfter) return;
      const [owner] = asset.uploaderUserId
        ? await tx
            .select()
            .from(homeMemberships)
            .where(
              and(
                eq(homeMemberships.homeId, asset.homeId),
                eq(homeMemberships.userId, asset.uploaderUserId),
              ),
            )
            .for("share")
        : [];
      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.mediaAssetId, asset.id), isNull(posts.deletedAt)))
        .limit(1);
      const [reel] = await tx
        .select({ id: reels.id })
        .from(reels)
        .where(and(eq(reels.mediaAssetId, asset.id), isNull(reels.deletedAt)))
        .limit(1);
      const [book] = await tx
        .select({ id: bookEntries.id })
        .from(bookEntries)
        .where(
          and(
            eq(bookEntries.mediaAssetId, asset.id),
            isNull(bookEntries.deletedAt),
          ),
        )
        .limit(1);
      if (post || reel || book) {
        // Referenced checksum-bound originals stay protected while their uploader
        // remains a member. Cancellation, loss of all references, or revocation
        // makes the reservation eligible for reclamation.
        if (asset.uploadChecksum && owner) return;
        await tx
          .update(posts)
          .set({ deletedAt: new Date(), revision: sql`${posts.revision} + 1` })
          .where(
            and(eq(posts.mediaAssetId, asset.id), isNull(posts.deletedAt)),
          );
        await tx
          .update(reels)
          .set({ deletedAt: new Date(), revision: sql`${reels.revision} + 1` })
          .where(
            and(eq(reels.mediaAssetId, asset.id), isNull(reels.deletedAt)),
          );
        await tx
          .update(bookEntries)
          .set({
            deletedAt: new Date(),
            revision: sql`${bookEntries.revision} + 1`,
          })
          .where(
            and(
              eq(bookEntries.mediaAssetId, asset.id),
              isNull(bookEntries.deletedAt),
            ),
          );
      }
      const after = new Date(
        Math.max(
          Date.now(),
          (asset.uploadExpiresAt?.getTime() ?? 0) + 30 * 60_000,
        ),
      );
      await tx
        .update(mediaAssets)
        .set({ state: "expired", cleanupAfter: after })
        .where(eq(mediaAssets.id, asset.id));
      await recordMediaWork(tx, {
        kind: "cleanup-media",
        homeId: asset.homeId,
        assetId: asset.id,
        keys: [asset.storageKey],
        availableAt: after,
      });
    });
  // A PUT that began before ticket expiry may finish after the first cleanup.
  // Recheck expired keys daily; a late writer cannot leave a permanent orphan.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expired = await database
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.state, "expired"),
        lte(mediaAssets.cleanupAfter, new Date()),
        notExists(
          database
            .select({ id: mediaWork.id })
            .from(mediaWork)
            .where(
              and(
                eq(mediaWork.assetId, mediaAssets.id),
                eq(mediaWork.kind, "cleanup-media"),
                gte(mediaWork.availableAt, today),
              ),
            ),
        ),
      ),
    )
    .limit(100);
  for (const asset of expired)
    await database.transaction((tx) =>
      recordMediaWork(tx, {
        kind: "cleanup-media",
        homeId: asset.homeId,
        assetId: asset.id,
        availableAt: today,
        keys: [asset.storageKey, asset.thumbnailKey, asset.posterKey].filter(
          (key): key is string => Boolean(key),
        ),
      }),
    );
  await database
    .delete(mediaWork)
    .where(lte(mediaWork.completedAt, new Date(Date.now() - 30 * 86400_000)));
  return dispatchMediaWork(database, publish);
}
