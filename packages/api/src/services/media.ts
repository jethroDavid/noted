import "server-only";
import { randomUUID } from "node:crypto";
import { bookEntries, db, mediaAssets, posts, reels } from "@noted/db/src";
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
  isMissingKey,
  objectExists,
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
import { and, asc, desc, eq, like, lte, not } from "drizzle-orm";
import { boardChanged, mediaChanged } from "./events";
import { findMemberHome, requireMemberHome } from "./homes";
import type { CurrentUser } from "./identity";

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
    width: null,
    height: null,
  });
  const ticket = await presignPut(key, input.contentType, input.byteSize);
  return { assetId, uploadUrl: ticket.url };
}

// One attach per asset: the row must be pending, home-owned,
// kind-matching, and not already attached to a post or reel. Bytes are NOT
// checked here — the post is created instantly and the browser PUTs in the
// background; confirmUpload verifies the bytes landed.
export async function requirePendingUpload(
  homeId: string,
  assetId: string,
  kind: "photo" | "video",
) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset || asset.homeId !== homeId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found." });
  }
  if (asset.kind !== kind) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This upload is a ${asset.kind}, not a ${kind}.`,
    });
  }
  if (asset.state !== "pending") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This upload is already attached.",
    });
  }
  const [postRef] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.mediaAssetId, asset.id))
    .limit(1);
  const [reelRef] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(eq(reels.mediaAssetId, asset.id))
    .limit(1);
  if (postRef ?? reelRef) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This upload is already attached.",
    });
  }
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
  const home = await requireMemberHome(user, homeId);
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset || asset.homeId !== home.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found." });
  }
  if (asset.state === "attached") {
    const variantKey =
      asset.kind === "photo" ? asset.thumbnailKey : asset.posterKey;
    const status = mediaDisplayStatus({
      state: asset.state,
      storageKey: asset.storageKey,
      variantKey,
    });
    if (status === "processing") {
      await publishJob({
        job: "process-media",
        homeId: home.id,
        assetId: asset.id,
      });
    }
    return { assetId: asset.id };
  }
  if (asset.state !== "pending") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This upload has expired.",
    });
  }
  if (!(await objectExists(asset.storageKey))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Upload bytes not found — retry the upload.",
    });
  }
  await db
    .update(mediaAssets)
    .set({ state: "attached" })
    .where(eq(mediaAssets.id, asset.id));
  await publishJob({
    job: "process-media",
    homeId: home.id,
    assetId: asset.id,
  });
  return { assetId: asset.id };
}

async function toReel(
  reel: { id: string; homeId: string; createdAt: Date },
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
  const home = await requireMemberHome(user, homeId);
  const asset = await requirePendingUpload(home.id, input.assetId, "video");
  const reel = await db.transaction(async (transaction) => {
    const [inserted] = await transaction
      .insert(reels)
      .values({
        homeId: home.id,
        mediaAssetId: asset.id,
        creatorUserId: user.id,
      })
      .returning();
    if (!inserted) throw new Error("Reel insert returned no row.");
    return inserted;
  });
  await mediaChanged(home.id);
  return toReel(reel, asset);
}

export async function listReels(
  user: CurrentUser,
  homeId: string,
): Promise<ReelsResponse> {
  const home = await requireMemberHome(user, homeId);
  const rows = await db
    .select({
      id: reels.id,
      homeId: reels.homeId,
      createdAt: reels.createdAt,
      state: mediaAssets.state,
      storageKey: mediaAssets.storageKey,
      posterKey: mediaAssets.posterKey,
    })
    .from(reels)
    .innerJoin(mediaAssets, eq(reels.mediaAssetId, mediaAssets.id))
    .where(eq(reels.homeId, home.id))
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
      archivedAt: bookEntries.archivedAt,
      kind: mediaAssets.kind,
      storageKey: mediaAssets.storageKey,
      thumbnailKey: mediaAssets.thumbnailKey,
      posterKey: mediaAssets.posterKey,
    })
    .from(bookEntries)
    .innerJoin(mediaAssets, eq(bookEntries.mediaAssetId, mediaAssets.id))
    .where(eq(bookEntries.homeId, home.id))
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
    .where(eq(posts.mediaAssetId, assetId))
    .limit(1);
  const [reelRef] = await transaction
    .select({ id: reels.id })
    .from(reels)
    .where(eq(reels.mediaAssetId, assetId))
    .limit(1);
  const [bookRef] = await transaction
    .select({ id: bookEntries.id })
    .from(bookEntries)
    .where(eq(bookEntries.mediaAssetId, assetId))
    .limit(1);
  if (postRef ?? reelRef ?? bookRef) return [];
  const [asset] = await transaction
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset) return [];
  await transaction.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  // Empty keys (the posterless-reel marker) delete nothing and would fail
  // the cleanup payload's min(1) keys, so they never leave this filter.
  return [asset.storageKey, asset.thumbnailKey, asset.posterKey].filter(
    (key): key is string => key !== null && key.length > 0,
  );
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
    .delete(reels)
    .where(eq(reels.id, reel.id))
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
  const status = asset
    ? mediaDisplayStatus({
        state: asset.state,
        storageKey: asset.storageKey,
        variantKey: asset.posterKey,
      })
    : "uploading";
  if (status === "ready") {
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
  input: { reelId: string },
): Promise<{ reelId: string }> {
  const home = await requireMemberHome(user, homeId);
  const [reel] = await db
    .select({ id: reels.id, mediaAssetId: reels.mediaAssetId })
    .from(reels)
    .where(and(eq(reels.id, input.reelId), eq(reels.homeId, home.id)))
    .limit(1);
  if (!reel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Reel not found." });
  }
  const outcome = await db.transaction(async (transaction) =>
    removeReelRow(
      transaction,
      { id: reel.id, homeId: home.id, mediaAssetId: reel.mediaAssetId },
      user.id,
    ),
  );
  // The pre-check found the row, so a missing removal means a concurrent
  // delete won the race: report NOT_FOUND like the row was never there.
  if (!outcome.removed) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Reel not found." });
  }
  await mediaChanged(home.id);
  if (outcome.keys.length > 0) {
    await publishJob({
      job: "cleanup-media",
      homeId: home.id,
      assetId: reel.mediaAssetId,
      keys: outcome.keys,
    });
  }
  return { reelId: reel.id };
}

export async function deleteBookEntry(
  user: CurrentUser,
  homeId: string,
  input: { entryId: string },
): Promise<{ entryId: string }> {
  const home = await requireMemberHome(user, homeId);
  const [entry] = await db
    .select({ id: bookEntries.id, mediaAssetId: bookEntries.mediaAssetId })
    .from(bookEntries)
    .where(
      and(eq(bookEntries.id, input.entryId), eq(bookEntries.homeId, home.id)),
    )
    .limit(1);
  if (!entry) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Book entry not found.",
    });
  }
  const keys = await db.transaction(async (transaction) => {
    await transaction.delete(bookEntries).where(eq(bookEntries.id, entry.id));
    return deleteAssetIfOrphaned(transaction, entry.mediaAssetId);
  });
  await mediaChanged(home.id);
  if (keys.length > 0) {
    await publishJob({
      job: "cleanup-media",
      homeId: home.id,
      assetId: entry.mediaAssetId,
      keys,
    });
  }
  return { entryId: entry.id };
}

// The home's media stream: yields validated room events, rechecking
// membership before each one so a revoked member's stream ends at the next
// event instead of leaking further updates. Clients refetch onStarted, so
// no initial yield is needed (unlike presence, there is nothing to join).
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
  const [asset] = await db
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
      console.error(
        `Skipping process-media: source blob is gone (${asset.storageKey}).`,
      );
      return;
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
        await db
          .update(mediaAssets)
          .set({ thumbnailKey: asset.storageKey })
          .where(eq(mediaAssets.id, asset.id));
        break;
      }
      const key = thumbnailKey(asset.homeId, asset.id);
      await putObjectBytes(key, thumbnail.bytes, "image/jpeg");
      await db
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
        await db
          .update(mediaAssets)
          .set({ posterKey: NO_POSTER_KEY })
          .where(eq(mediaAssets.id, asset.id));
        break;
      }
      const key = posterKey(asset.homeId, asset.id);
      await putObjectBytes(key, poster, "image/jpeg");
      await db
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
  const [post] = await db
    .select({ boardId: posts.boardId })
    .from(posts)
    .where(eq(posts.mediaAssetId, asset.id))
    .limit(1);
  if (post) await boardChanged(post.boardId);
  const [reel] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(eq(reels.mediaAssetId, asset.id))
    .limit(1);
  if (reel) await mediaChanged(asset.homeId);
}

// Removes orphaned blobs by key. Fixture keys are skipped inside the media
// package (never deleted); partial failures throw for a QStash retry.
export async function handleCleanupMedia(job: CleanupMediaJob): Promise<void> {
  const outcome = await deleteUploadBlobs(job.keys);
  console.log(
    `Cleaned up asset ${job.assetId}: ${outcome.deleted.length} blob(s) deleted, ${outcome.skipped.length} skipped.`,
  );
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
