import "server-only";
import { randomUUID } from "node:crypto";
import {
  bookEntries,
  db,
  homeMemberships,
  mediaAssets,
  posts,
  reels,
} from "@noted/db/src";
import {
  isReelExpired,
  mediaDisplayStatus,
  REEL_LIFETIME_MS,
  reelExpiresAt,
} from "@noted/domain/src";
import {
  deleteUploadBlobs,
  extensionForContentType,
  getObjectBytes,
  inspectObject,
  isMissingKey,
  originalKey,
  posterKey,
  presignPut,
  putObjectBytes,
  thumbnailKey,
  viewUrl,
} from "@noted/media/src";
import { publishJob } from "@noted/queue/src";
import type {
  CleanupMediaJob,
  ProcessMediaJob,
  SweepReelsJob,
} from "@noted/queue/src";
import { subscribeToHome } from "@noted/realtime/src";
import type {
  BookResponse,
  CreateReelInput,
  MediaEvent,
  Reel,
  ReelsResponse,
  RequestUploadInput,
  UploadTicket,
} from "@noted/validators/src";
import { mediaEventSchema } from "@noted/validators/src";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, like, lte, not, sql } from "drizzle-orm";
import { boardChanged, mediaChanged } from "./events";
import { findMemberHome, requireMemberHome } from "./homes";
import type { CurrentUser } from "./identity";
import { applyMediaOperation } from "./media-sync";
import {
  completeMediaWork,
  dispatchMediaWork,
  recordMediaWork,
} from "./media-work";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A switch over every media kind ends with this, so a new kind fails the
// build until each switch handles it.
function assertNever(value: never): never {
  throw new Error(`Unhandled media kind: ${String(value)}`);
}

// Mints a pending asset plus a presigned PUT ticket. The ticket binds
// content type and byte size, so the upload is good for exactly what the
// server approved; confirming verifies the bytes landed.
export async function requestUpload(
  user: CurrentUser,
  homeId: string,
  input: Omit<RequestUploadInput, "homeId">,
): Promise<UploadTicket> {
  const home = await requireMemberHome(user, homeId);
  const extension = extensionForContentType(input.contentType);
  const assetId = randomUUID();
  const key = originalKey(home.id, assetId, extension);
  await db.insert(mediaAssets).values({
    id: assetId,
    homeId: home.id,
    kind: input.kind,
    state: "pending",
    storageKey: key,
    contentType: input.contentType,
    byteSize: input.byteSize,
    uploaderUserId: user.id,
    uploadChecksum: input.checksum,
    uploadExpiresAt: new Date(Date.now() + 900_000),
    width: null,
    height: null,
  });
  const ticket = await presignPut(
    key,
    input.contentType,
    input.byteSize,
    input.checksum,
  );
  return { assetId, uploadUrl: ticket.url };
}

export async function cancelUpload(
  user: CurrentUser,
  homeId: string,
  assetId: string,
) {
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(homeMemberships)
      .where(
        and(
          eq(homeMemberships.homeId, homeId),
          eq(homeMemberships.userId, user.id),
        ),
      )
      .for("share");
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)))
      .for("update");
    if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
    if (asset.uploaderUserId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN" });
    if (asset.state === "attached")
      throw new TRPCError({
        code: "CONFLICT",
        message: "This original was already accepted.",
      });
    if (asset.state === "expired") return;
    await tx
      .update(posts)
      .set({ deletedAt: new Date(), revision: sql`${posts.revision} + 1` })
      .where(and(eq(posts.mediaAssetId, asset.id), isNull(posts.deletedAt)));
    await tx
      .update(reels)
      .set({ deletedAt: new Date(), revision: sql`${reels.revision} + 1` })
      .where(and(eq(reels.mediaAssetId, asset.id), isNull(reels.deletedAt)));
    await deleteAssetIfOrphaned(tx, asset.id);
  });
  return { assetId };
}

// One attach per asset: the row must be pending, home-owned,
// kind-matching, and not already attached to a post or reel. Bytes are NOT
// checked here — the post is created instantly and the browser PUTs in the
// background; confirmUpload verifies the bytes landed.
export async function requirePendingUpload(
  user: CurrentUser,
  homeId: string,
  assetId: string,
  kind: "photo" | "video",
  tx: Transaction,
) {
  const [member] = await tx
    .select()
    .from(homeMemberships)
    .where(
      and(
        eq(homeMemberships.homeId, homeId),
        eq(homeMemberships.userId, user.id),
      ),
    )
    .for("share");
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  const [asset] = await tx
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)))
    .for("update");
  if (!asset)
    throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found." });
  if (asset.kind !== kind)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Upload kind does not match.",
    });
  if (asset.uploaderUserId !== user.id)
    throw new TRPCError({ code: "FORBIDDEN" });
  if (asset.state === "expired" || asset.cleanupAfter)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This upload was canceled.",
    });
  return asset;
}

// Flips a pending asset to attached after the browser's background PUT
// lands, then ensures variant processing is queued. Idempotent: a retried
// confirm re-queues a still-unprocessed asset (processing is idempotent
// downstream) and no-ops once the variant exists. Emits no events —
// uploading and processing both render a spinner, so subscribers wait for
// the worker's completion event instead of refetching twice.
export async function confirmUpload(
  user: CurrentUser,
  homeId: string,
  assetId: string,
): Promise<{ assetId: string }> {
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(homeMemberships)
      .where(
        and(
          eq(homeMemberships.homeId, homeId),
          eq(homeMemberships.userId, user.id),
        ),
      )
      .for("share");
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)))
      .for("update");
    if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
    if (asset.uploaderUserId && asset.uploaderUserId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN" });
    if (asset.state === "expired" || asset.cleanupAfter)
      throw new TRPCError({
        code: "CONFLICT",
        message: "This upload was canceled.",
      });
    if (asset.state === "pending") {
      const object = await inspectObject(asset.storageKey);
      if (
        !object ||
        object.byteSize !== asset.byteSize ||
        object.contentType !== asset.contentType
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload bytes do not match the reservation.",
        });
      await tx
        .update(mediaAssets)
        .set({ state: "attached", verifiedAt: new Date() })
        .where(eq(mediaAssets.id, asset.id));
    }
    if (asset.kind === "photo" ? !asset.thumbnailKey : asset.posterKey === null)
      await recordMediaWork(tx, { kind: "process-media", homeId, assetId });
  });
  void dispatchMediaWork().catch(() => {});
  return { assetId };
}

async function toReel(
  reel: { id: string; homeId: string; createdAt: Date; revision?: number },
  asset: {
    state: string;
    storageKey: string;
    posterKey: string | null;
  },
): Promise<Reel> {
  const status = mediaDisplayStatus({
    state: asset.state,
    storageKey: asset.storageKey,
    variantKey: asset.posterKey,
  });
  // Fixture reels stay on TV permanently: a null expiry tells the UI to
  // show no countdown, matching the sweep's fixture exclusion.
  const expiresAt = asset.storageKey.startsWith("fixtures/")
    ? null
    : reelExpiresAt(reel.createdAt);
  if (status !== "ready") {
    return {
      id: reel.id,
      revision: reel.revision ?? 1,
      homeId: reel.homeId,
      status,
      videoUrl: null,
      posterUrl: null,
      createdAt: reel.createdAt,
      expiresAt,
    };
  }
  return {
    id: reel.id,
    revision: reel.revision ?? 1,
    homeId: reel.homeId,
    status,
    videoUrl: await viewUrl(asset.storageKey),
    posterUrl: asset.posterKey ? await viewUrl(asset.posterKey) : null,
    createdAt: reel.createdAt,
    expiresAt,
  };
}

// Instant attach: the reel row is created against the still-pending asset
// and subscribers see a spinner; the browser PUTs bytes in the background
// and confirmUpload queues processing once they land.
export async function createReel(
  user: CurrentUser,
  homeId: string,
  input: CreateReelInput,
): Promise<Reel> {
  const result = await db.transaction(async (tx) => {
    const asset = await requirePendingUpload(
      user,
      homeId,
      input.assetId,
      "video",
      tx,
    );
    const [existing] = await tx
      .select()
      .from(reels)
      .where(eq(reels.mediaAssetId, asset.id))
      .limit(1);
    if (existing) return { reel: existing, asset };
    if (asset.state !== "pending")
      throw new TRPCError({
        code: "CONFLICT",
        message: "Original already accepted without this attachment.",
      });
    const [reel] = await tx
      .insert(reels)
      .values({ homeId, mediaAssetId: asset.id, creatorUserId: user.id })
      .returning();
    if (!reel) throw Error("Reel insert returned no row.");
    return { reel, asset };
  });
  await mediaChanged(homeId);
  return toReel(result.reel, result.asset);
}

export async function listReels(
  user: CurrentUser,
  homeId: string,
): Promise<ReelsResponse> {
  const home = await requireMemberHome(user, homeId);
  const rows = await db
    .select({
      id: reels.id,
      revision: reels.revision,
      homeId: reels.homeId,
      createdAt: reels.createdAt,
      state: mediaAssets.state,
      storageKey: mediaAssets.storageKey,
      posterKey: mediaAssets.posterKey,
    })
    .from(reels)
    .innerJoin(mediaAssets, eq(reels.mediaAssetId, mediaAssets.id))
    .where(and(eq(reels.homeId, home.id), isNull(reels.deletedAt)))
    .orderBy(desc(reels.createdAt), desc(reels.id));
  return { reels: await Promise.all(rows.map((row) => toReel(row, row))) };
}

export async function listBook(
  user: CurrentUser,
  homeId: string,
): Promise<BookResponse> {
  const home = await requireMemberHome(user, homeId);
  const rows = await db
    .select({
      id: bookEntries.id,
      revision: bookEntries.revision,
      archivedAt: bookEntries.archivedAt,
      kind: mediaAssets.kind,
      storageKey: mediaAssets.storageKey,
      thumbnailKey: mediaAssets.thumbnailKey,
      posterKey: mediaAssets.posterKey,
    })
    .from(bookEntries)
    .innerJoin(mediaAssets, eq(bookEntries.mediaAssetId, mediaAssets.id))
    .where(and(eq(bookEntries.homeId, home.id), isNull(bookEntries.deletedAt)))
    // Oldest first: like a physical photobook, new entries append at the
    // back instead of jumping the front.
    .orderBy(asc(bookEntries.archivedAt), asc(bookEntries.id));
  const entries = await Promise.all(
    rows.map(async (row) => {
      switch (row.kind) {
        case "photo": {
          const imageUrl = await viewUrl(row.storageKey);
          return {
            kind: "photo" as const,
            id: row.id,
            revision: row.revision,
            thumbnailUrl: row.thumbnailKey
              ? await viewUrl(row.thumbnailKey)
              : imageUrl,
            imageUrl,
            archivedAt: row.archivedAt,
          };
        }
        case "video": {
          // Empty posterKey is the posterless-reel marker: the page shows a
          // placeholder tile and the modal still plays the video.
          const posterUrl = row.posterKey ? await viewUrl(row.posterKey) : null;
          return {
            kind: "clip" as const,
            id: row.id,
            posterUrl,
            videoUrl: await viewUrl(row.storageKey),
            archivedAt: row.archivedAt,
          };
        }
        default:
          return assertNever(row.kind);
      }
    }),
  );
  return { entries };
}

// Deletes the asset row only when nothing references it anymore (posts,
// reels, and sibling book entries all count). Returns the blob keys the
// cleanup worker should remove. Shared with the posts service for removing
// never-ready photo posts.
export async function deleteAssetIfOrphaned(
  transaction: Transaction,
  assetId: string,
): Promise<string[]> {
  const [postRef] = await transaction
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.mediaAssetId, assetId), isNull(posts.deletedAt)))
    .limit(1);
  const [reelRef] = await transaction
    .select({ id: reels.id })
    .from(reels)
    .where(and(eq(reels.mediaAssetId, assetId), isNull(reels.deletedAt)))
    .limit(1);
  const [bookRef] = await transaction
    .select({ id: bookEntries.id })
    .from(bookEntries)
    .where(
      and(eq(bookEntries.mediaAssetId, assetId), isNull(bookEntries.deletedAt)),
    )
    .limit(1);
  if (postRef ?? reelRef ?? bookRef) return [];
  const [asset] = await transaction
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset) return [];
  const after = new Date(
    Math.max(
      Date.now() + 30 * 60_000,
      (asset.uploadExpiresAt?.getTime() ?? 0) + 30 * 60_000,
    ),
  );
  await transaction
    .update(mediaAssets)
    .set({ state: "expired", cleanupAfter: after })
    .where(eq(mediaAssets.id, assetId));
  // Empty keys (the posterless-reel marker) delete nothing and would fail
  // the cleanup payload's min(1) keys, so they never leave this filter.
  const keys = [asset.storageKey, asset.thumbnailKey, asset.posterKey].filter(
    (key): key is string => key !== null && key.length > 0,
  );
  await recordMediaWork(transaction, {
    kind: "cleanup-media",
    homeId: asset.homeId,
    assetId,
    keys,
    availableAt: after,
  });
  // The durable dispatcher owns the delayed publication.
  return [];
}

interface ReelRemoval {
  removed: boolean;
  archived: boolean;
  keys: string[];
}

// Removes one reel row: ready reels archive to the photobook, never-ready
// ones (a failed or abandoned upload) are discarded with their orphaned
// asset, mirroring removePost's photo path. Shared by manual delete and the
// sweep; the only difference is who is recorded as the archiver. A missing
// row (lost race, double delete) removes nothing and lets the caller decide
// between NOT_FOUND and skip.
async function removeReelRow(
  transaction: Transaction,
  reel: { id: string; homeId: string; mediaAssetId: string },
  archivedByUserId: string,
): Promise<ReelRemoval> {
  const deleted = await transaction
    .update(reels)
    .set({ deletedAt: new Date() })
    .where(and(eq(reels.id, reel.id), isNull(reels.deletedAt)))
    .returning({ id: reels.id });
  if (deleted.length === 0)
    return { removed: false, archived: false, keys: [] };
  // Readiness is re-read inside the transaction so a poster landing
  // mid-removal still archives instead of discarding the clip.
  const [asset] = await transaction
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, reel.mediaAssetId))
    .limit(1);
  if (asset?.state === "attached") {
    await transaction.insert(bookEntries).values({
      homeId: reel.homeId,
      mediaAssetId: reel.mediaAssetId,
      archivedFromReelId: reel.id,
      archivedByUserId,
    });
    return { removed: true, archived: true, keys: [] };
  }
  const keys = await deleteAssetIfOrphaned(transaction, reel.mediaAssetId);
  return { removed: true, archived: false, keys };
}

export async function deleteReel(
  user: CurrentUser,
  homeId: string,
  input: { reelId: string; expectedRevision?: number; operationId?: string },
): Promise<{ reelId: string }> {
  await requireMemberHome(user, homeId);
  const [row] = await db
    .select()
    .from(reels)
    .where(and(eq(reels.id, input.reelId), eq(reels.homeId, homeId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const result = await applyMediaOperation(user, {
    kind: "archive-video",
    operationId: input.operationId ?? randomUUID(),
    homeId,
    itemId: row.id,
    expectedRevision: input.expectedRevision ?? row.revision,
  });
  if (result.code !== "ACCEPTED")
    throw new TRPCError({
      code:
        result.code === "DELETE_REQUIRES_CONFIRMATION"
          ? "CONFLICT"
          : result.code === "ACCESS_REVOKED"
            ? "FORBIDDEN"
            : "BAD_REQUEST",
      message: "This item changed. Review it before removing it again.",
    });
  return { reelId: row.id };
}

export async function deleteBookEntry(
  user: CurrentUser,
  homeId: string,
  input: { entryId: string; expectedRevision?: number; operationId?: string },
): Promise<{ entryId: string }> {
  await requireMemberHome(user, homeId);
  const [row] = await db
    .select()
    .from(bookEntries)
    .where(
      and(eq(bookEntries.id, input.entryId), eq(bookEntries.homeId, homeId)),
    );
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const result = await applyMediaOperation(user, {
    kind: "delete-book",
    operationId: input.operationId ?? randomUUID(),
    homeId,
    itemId: row.id,
    expectedRevision: input.expectedRevision ?? row.revision,
  });
  if (result.code !== "ACCEPTED")
    throw new TRPCError({
      code:
        result.code === "DELETE_REQUIRES_CONFIRMATION"
          ? "CONFLICT"
          : result.code === "ACCESS_REVOKED"
            ? "FORBIDDEN"
            : "BAD_REQUEST",
      message: "This item changed. Review it before removing it again.",
    });
  return { entryId: row.id };
}

export async function* watchHome(
  user: CurrentUser,
  homeId: string,
): AsyncGenerator<MediaEvent> {
  const home = await requireMemberHome(user, homeId);
  const queue: MediaEvent[] = [];
  let wake: (() => void) | null = null;
  const unsubscribe = await subscribeToHome(home.id, (event) => {
    const parsed = mediaEventSchema.safeParse(event);
    if (!parsed.success) {
      console.error("Dropping home event that fails validation.");
      return;
    }
    queue.push(parsed.data);
    wake?.();
  });
  try {
    for (;;) {
      while (queue.length > 0) {
        const event = queue.shift();
        if (!event) break;
        const membership = await findMemberHome(user.id, homeId);
        // Throwing (not silently ending) tells the client to refetch, and
        // the refetch 404s into the "Home not found" screen: access ends
        // immediately and visibly, matching the HTTP behavior.
        if (!membership) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Home not found.",
          });
        }
        yield event;
      }
      // The executor runs synchronously, so a push can only land before
      // (queue non-empty, the loop continues) or after (wake is set).
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = null;
    }
  } finally {
    wake = null;
    await unsubscribe();
  }
}

// Marks a reel whose poster generation failed terminally (corrupt bytes,
// sub-second clip): the reel is ready and plays, just without a poster.
// Any non-null key reads as ready; the empty one deletes nothing and is
// filtered out of cleanup payloads (whose schema requires min(1)).
const NO_POSTER_KEY = "";

// Generates an asset's variants: thumbnails plus dimensions for photos,
// poster frames for reels. Idempotent under QStash's at-least-once
// delivery (deterministic keys, overwriting puts, harmless re-events).
// Permanent content failures log and degrade (photos fall back to the
// original, reels play without a poster) so nothing strands a spinner;
// transient S3 failures throw for a retry; a deleted source stops quietly.
export async function handleProcessMedia(job: ProcessMediaJob): Promise<void> {
  await db.transaction(async (transaction) => {
    const [locked] = await transaction
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, job.assetId),
          eq(mediaAssets.homeId, job.homeId),
        ),
      )
      .for("update");
    if (!locked || locked.state !== "attached") return;
    await processMedia(job, transaction);
  });
  await completeMediaWork("process-media", job.assetId, job.workId);
}

async function processMedia(job: ProcessMediaJob, database: Transaction) {
  const [asset] = await database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, job.assetId))
    .limit(1);
  if (!asset) {
    console.log(`Skipping process-media for deleted asset ${job.assetId}.`);
    return;
  }
  let original: Buffer;
  try {
    original = await getObjectBytes(asset.storageKey);
  } catch (error) {
    if (isMissingKey(error)) {
      console.error(`Original missing for accepted asset ${asset.id}.`);
      throw new Error("ACCEPTED_ORIGINAL_MISSING");
    }
    throw error;
  }
  // Variants pull sharp/ffmpeg native binaries — lazy-load so server
  // bundles that never process media (tRPC routes) never evaluate them.
  const { makePoster, makeThumbnail } =
    await import("@noted/media/src/variants");
  switch (asset.kind) {
    case "photo": {
      let thumbnail;
      try {
        thumbnail = await makeThumbnail(original);
      } catch (error) {
        console.error(
          `Serving original for asset ${asset.id} (thumbnail failed):`,
          error,
        );
        await database
          .update(mediaAssets)
          .set({ thumbnailKey: asset.storageKey })
          .where(eq(mediaAssets.id, asset.id));
        break;
      }
      const key = thumbnailKey(asset.homeId, asset.id);
      await putObjectBytes(key, thumbnail.bytes, "image/jpeg");
      await database
        .update(mediaAssets)
        .set({
          thumbnailKey: key,
          width: thumbnail.width,
          height: thumbnail.height,
        })
        .where(eq(mediaAssets.id, asset.id));
      break;
    }
    case "video": {
      let poster: Buffer;
      try {
        poster = await makePoster(
          original,
          extensionForContentType(asset.contentType),
        );
      } catch (error) {
        console.error(
          `Serving asset ${asset.id} without a poster (poster failed):`,
          error,
        );
        await database
          .update(mediaAssets)
          .set({ posterKey: NO_POSTER_KEY })
          .where(eq(mediaAssets.id, asset.id));
        break;
      }
      const key = posterKey(asset.homeId, asset.id);
      await putObjectBytes(key, poster, "image/jpeg");
      await database
        .update(mediaAssets)
        .set({ posterKey: key })
        .where(eq(mediaAssets.id, asset.id));
      break;
    }
    default:
      return assertNever(asset.kind);
  }
  // Completion events, resolved by lookup (not payload ids) so retries
  // stay idempotent: the board swaps originals for thumbnails, TV picks
  // up posters. Attachments deleted mid-flight simply skip their event.
  const [post] = await database
    .select({ boardId: posts.boardId })
    .from(posts)
    .where(eq(posts.mediaAssetId, asset.id))
    .limit(1);
  if (post) await boardChanged(post.boardId);
  const [reel] = await database
    .select({ id: reels.id })
    .from(reels)
    .where(eq(reels.mediaAssetId, asset.id))
    .limit(1);
  if (reel) await mediaChanged(asset.homeId);
}

// Removes orphaned blobs by key. Fixture keys are skipped inside the media
// package (never deleted); partial failures throw for a QStash retry.
export async function handleCleanupMedia(
  job: CleanupMediaJob,
  database: typeof db = db,
): Promise<void> {
  const completed = await database.transaction(async (tx) => {
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, job.assetId))
      .for("update");
    if (!asset) {
      // A signed job is still only intent: without canonical ownership we
      // cannot safely delete keys supplied in its payload.
      console.warn(
        `Cleanup skipped: asset ${job.assetId} has no canonical record.`,
      );
      return true;
    }
    if (asset.homeId !== job.homeId)
      throw new Error("Cleanup asset scope mismatch.");
    if (!asset.cleanupAfter || asset.cleanupAfter > new Date()) return false;
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
    const [entry] = await tx
      .select({ id: bookEntries.id })
      .from(bookEntries)
      .where(
        and(
          eq(bookEntries.mediaAssetId, asset.id),
          isNull(bookEntries.deletedAt),
        ),
      )
      .limit(1);
    if (post || reel || entry) {
      await tx
        .update(mediaAssets)
        .set({ cleanupAfter: null })
        .where(eq(mediaAssets.id, asset.id));
      return true;
    }
    await deleteUploadBlobs(
      [asset.storageKey, asset.thumbnailKey, asset.posterKey].filter(
        (key): key is string => Boolean(key),
      ),
    );
    await tx
      .update(mediaAssets)
      .set({ state: "expired" })
      .where(eq(mediaAssets.id, asset.id));
    return true;
  });
  if (completed)
    await completeMediaWork("cleanup-media", job.assetId, job.workId, database);
}

// Reels swept per scheduled run. The job is cheap to repeat (a re-run finds
// no rows), so the batch just bounds one worker invocation.
const SWEEP_BATCH_SIZE = 100;

// Archives every expired reel to the photobook: ready reels become clip
// entries, never-ready ones (a lost process job stranded the upload) are
// deleted like removePost's never-ready photos. Fixture reels are excluded
// by key prefix — they are permanent sample content, not uploads.
// Idempotent under retry and safe under overlapping runs: each reel moves
// inside one transaction guarded by delete-returning, so a second run finds
// no row and skips.
export async function handleSweepReels(_job: SweepReelsJob): Promise<void> {
  const now = new Date();
  const candidates = await db
    .select({
      id: reels.id,
      homeId: reels.homeId,
      mediaAssetId: reels.mediaAssetId,
      creatorUserId: reels.creatorUserId,
      createdAt: reels.createdAt,
    })
    .from(reels)
    .innerJoin(mediaAssets, eq(reels.mediaAssetId, mediaAssets.id))
    .where(
      and(
        lte(reels.createdAt, new Date(now.getTime() - REEL_LIFETIME_MS)),
        isNull(reels.deletedAt),
        eq(mediaAssets.state, "attached"),
        not(like(mediaAssets.storageKey, "fixtures/%")),
      ),
    )
    .orderBy(asc(reels.createdAt), asc(reels.id))
    .limit(SWEEP_BATCH_SIZE);
  const sweptHomeIds = new Set<string>();
  let archived = 0;
  let discarded = 0;
  for (const candidate of candidates) {
    // The SQL cutoff prefilters; the domain owns the expiry decision.
    if (!isReelExpired(candidate.createdAt, now)) continue;
    const outcome = await db.transaction(async (transaction) =>
      removeReelRow(
        transaction,
        {
          id: candidate.id,
          homeId: candidate.homeId,
          mediaAssetId: candidate.mediaAssetId,
        },
        candidate.creatorUserId,
      ),
    );
    // Lost a race with an overlapping sweep (or a manual delete): the
    // row is already gone, so there is nothing to archive.
    if (!outcome.removed) continue;
    if (outcome.archived) {
      archived += 1;
    } else {
      discarded += 1;
      if (outcome.keys.length > 0) {
        await publishJob({
          job: "cleanup-media",
          homeId: candidate.homeId,
          assetId: candidate.mediaAssetId,
          keys: outcome.keys,
        });
      }
    }
    sweptHomeIds.add(candidate.homeId);
  }
  for (const homeId of sweptHomeIds) {
    await mediaChanged(homeId);
  }
  console.log(
    `Swept reels: ${archived} archived, ${discarded} discarded, ${sweptHomeIds.size} home(s) changed.`,
  );
}
