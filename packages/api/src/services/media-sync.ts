import "server-only";
import { createHash } from "node:crypto";
import {
  boards,
  bookEntries,
  db,
  homeMemberships,
  mediaAssets,
  posts,
  reels,
  syncReceipts,
} from "@noted/db/src";
import {
  extensionForContentType,
  inspectObject,
  originalKey,
  presignPut,
  viewUrl,
} from "@noted/media/src";
import {
  mediaOperationSchema,
  noteOutcomeSchema,
} from "@noted/validators/sync";
import type { MediaOperation, NoteOutcome } from "@noted/validators/sync";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { boardChanged, mediaChanged } from "./events";
import type { CurrentUser } from "./identity";
import { dispatchMediaWork, recordMediaWork } from "./media-work";
import { canonical } from "./sync";

export async function scopeStatus(user: CurrentUser, homeIds: string[]) {
  const memberships = homeIds.length
    ? await db
        .select({ homeId: homeMemberships.homeId })
        .from(homeMemberships)
        .where(
          and(
            eq(homeMemberships.userId, user.id),
            inArray(homeMemberships.homeId, homeIds),
          ),
        )
    : [];
  return homeIds.map((homeId) => ({
    homeId,
    allowed: memberships.some((member) => member.homeId === homeId),
  }));
}

export async function applyMediaOperation(
  user: CurrentUser,
  input: MediaOperation,
  database: typeof db = db,
): Promise<NoteOutcome> {
  const operation = mediaOperationSchema.parse(input);
  const fingerprint = createHash("sha256")
    .update(canonical(operation))
    .digest("hex");
  const outcome = await database.transaction(
    async (tx): Promise<NoteOutcome> => {
      const [membership] = await tx
        .select()
        .from(homeMemberships)
        .where(
          and(
            eq(homeMemberships.homeId, operation.homeId),
            eq(homeMemberships.userId, user.id),
          ),
        )
        .for("share");
      if (!membership) return { code: "ACCESS_REVOKED" };
      const [reserved] = await tx
        .insert(syncReceipts)
        .values({
          userId: user.id,
          operationId: operation.operationId,
          fingerprint,
          outcome: { pending: true },
        })
        .onConflictDoNothing()
        .returning();
      if (!reserved) {
        const [receipt] = await tx
          .select()
          .from(syncReceipts)
          .where(
            and(
              eq(syncReceipts.userId, user.id),
              eq(syncReceipts.operationId, operation.operationId),
            ),
          );
        if (!receipt) throw new Error("Missing media receipt.");
        return receipt.fingerprint === fingerprint
          ? noteOutcomeSchema.parse(receipt.outcome)
          : {
              code: "INVALID_OPERATION",
              message: "Operation ID already belongs to another change.",
            };
      }
      const finish = async (result: NoteOutcome) => {
        await tx
          .update(syncReceipts)
          .set({ outcome: result })
          .where(
            and(
              eq(syncReceipts.userId, user.id),
              eq(syncReceipts.operationId, operation.operationId),
            ),
          );
        return result;
      };
      const invalid = (message: string) =>
        finish({ code: "INVALID_OPERATION", message });
      if (operation.kind === "restore-photo") {
        const [board] = await tx
          .select()
          .from(boards)
          .where(
            and(
              eq(boards.id, operation.boardId),
              eq(boards.homeId, operation.homeId),
            ),
          )
          .for("share");
        const [entry] = await tx
          .select()
          .from(bookEntries)
          .where(eq(bookEntries.id, operation.archivedItemId))
          .for("update");
        if (!board || !entry || entry.homeId !== operation.homeId)
          return invalid("Archived photo does not belong to this home.");
        if (entry.deletedAt) return finish({ code: "ITEM_DELETED" });
        if (entry.revision !== operation.expectedRevision)
          return finish({
            code: "DELETE_REQUIRES_CONFIRMATION",
            revision: entry.revision,
          });
        const [asset] = await tx
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.id, entry.mediaAssetId))
          .for("update");
        if (!asset || asset.kind !== "photo" || asset.state === "expired")
          return finish({ code: "ITEM_DELETED" });
        const [post] = await tx
          .insert(posts)
          .values({
            id: operation.itemId,
            boardId: board.id,
            kind: "photo",
            mediaAssetId: asset.id,
            creatorUserId: user.id,
            positionX: operation.x,
            positionY: operation.y,
          })
          .onConflictDoNothing()
          .returning();
        if (!post) return invalid("Content identity already exists.");
        await tx
          .update(bookEntries)
          .set({ deletedAt: new Date(), revision: entry.revision + 1 })
          .where(eq(bookEntries.id, entry.id));
        await tx
          .update(mediaAssets)
          .set({ cleanupAfter: null })
          .where(eq(mediaAssets.id, asset.id));
        return finish({ code: "ACCEPTED", revision: 1 });
      }
      if (
        operation.kind === "create-photo" ||
        operation.kind === "create-video"
      ) {
        const kind = operation.kind === "create-photo" ? "photo" : "video";
        if (
          operation.upload.kind !== kind ||
          operation.upload.homeId !== operation.homeId
        )
          return invalid("Upload scope does not match content.");
        if (operation.kind === "create-photo") {
          const [board] = await tx
            .select()
            .from(boards)
            .where(
              and(
                eq(boards.id, operation.boardId),
                eq(boards.homeId, operation.homeId),
              ),
            )
            .for("share");
          if (!board) return invalid("Board does not belong to this home.");
        }
        const [asset] = await tx
          .insert(mediaAssets)
          .values({
            id: operation.assetId,
            homeId: operation.homeId,
            kind,
            storageKey: originalKey(
              operation.homeId,
              operation.assetId,
              extensionForContentType(operation.upload.contentType),
            ),
            contentType: operation.upload.contentType,
            byteSize: operation.upload.byteSize,
            uploaderUserId: user.id,
            uploadChecksum: operation.upload.checksum,
          })
          .onConflictDoNothing()
          .returning();
        if (!asset) return invalid("Asset identity already exists.");
        const inserted =
          operation.kind === "create-photo"
            ? await tx
                .insert(posts)
                .values({
                  id: operation.itemId,
                  boardId: operation.boardId,
                  creatorUserId: user.id,
                  kind: "photo",
                  mediaAssetId: asset.id,
                  positionX: operation.x,
                  positionY: operation.y,
                })
                .onConflictDoNothing()
                .returning({ id: posts.id })
            : await tx
                .insert(reels)
                .values({
                  id: operation.itemId,
                  homeId: operation.homeId,
                  creatorUserId: user.id,
                  mediaAssetId: asset.id,
                })
                .onConflictDoNothing()
                .returning({ id: reels.id });
        if (!inserted.length) {
          await tx.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
          return invalid("Content identity already exists.");
        }
        return finish({ code: "ACCEPTED", revision: 1 });
      }
      const table =
        operation.kind === "archive-video"
          ? reels
          : operation.kind === "delete-book"
            ? bookEntries
            : posts;
      const [item] = await tx
        .select()
        .from(table)
        .where(eq(table.id, operation.itemId))
        .for("update");
      if (!item) return finish({ code: "ITEM_DELETED" });
      let itemHome: string | undefined;
      if ("boardId" in item) {
        const [board] = await tx
          .select()
          .from(boards)
          .where(eq(boards.id, item.boardId));
        itemHome = board?.homeId;
        if (item.kind !== "photo") return invalid("This is not a photo.");
        if (
          operation.kind === "move-photo" &&
          operation.boardId !== item.boardId
        )
          return invalid("Photo board does not match.");
      } else itemHome = item.homeId;
      if (itemHome !== operation.homeId)
        return invalid("Content does not belong to this home.");
      if (item.deletedAt)
        return finish(
          operation.kind === "move-photo"
            ? { code: "ITEM_DELETED" }
            : { code: "ACCEPTED", revision: item.revision },
        );
      if (operation.kind === "move-photo") {
        await tx
          .update(posts)
          .set({
            positionX: operation.x,
            positionY: operation.y,
            revision: item.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, item.id));
      } else {
        if (item.revision !== operation.expectedRevision)
          return finish({
            code: "DELETE_REQUIRES_CONFIRMATION",
            revision: item.revision,
          });
        const now = new Date();
        await tx
          .update(table)
          .set({ deletedAt: now, revision: item.revision + 1 })
          .where(eq(table.id, item.id));
        if (operation.kind !== "delete-book" && item.mediaAssetId) {
          await tx
            .insert(bookEntries)
            .values({
              id: item.id,
              homeId: operation.homeId,
              mediaAssetId: item.mediaAssetId,
              archivedByUserId: user.id,
              ...(operation.kind === "archive-photo"
                ? { archivedFromPostId: item.id }
                : { archivedFromReelId: item.id }),
            })
            .onConflictDoNothing();
        } else if (item.mediaAssetId) {
          const [asset] = await tx
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.id, item.mediaAssetId))
            .for("update");
          if (asset) {
            const after = new Date(
              Math.max(
                now.getTime() + 30 * 60_000,
                (asset.uploadExpiresAt?.getTime() ?? 0) + 30 * 60_000,
              ),
            );
            await tx
              .update(mediaAssets)
              .set({ cleanupAfter: after })
              .where(eq(mediaAssets.id, asset.id));
            await recordMediaWork(tx, {
              kind: "cleanup-media",
              homeId: operation.homeId,
              assetId: asset.id,
              availableAt: after,
              keys: [
                asset.storageKey,
                asset.thumbnailKey,
                asset.posterKey,
              ].filter((k): k is string => Boolean(k)),
            });
          }
        }
      }
      return finish({ code: "ACCEPTED", revision: item.revision + 1 });
    },
  );
  if (outcome.code === "ACCEPTED") {
    void dispatchMediaWork().catch(() => {});
    void mediaChanged(operation.homeId).catch(() => {});
    if ("boardId" in operation)
      void boardChanged(operation.boardId).catch(() => {});
    else if (operation.kind === "archive-photo") {
      const [post] = await database
        .select({ boardId: posts.boardId })
        .from(posts)
        .where(eq(posts.id, operation.itemId));
      if (post) void boardChanged(post.boardId).catch(() => {});
    }
  }
  return outcome;
}

export async function nativeUploadTicket(
  user: CurrentUser,
  homeId: string,
  assetId: string,
  database: typeof db = db,
) {
  return database.transaction(async (tx) => {
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
    if (!member) return { code: "ACCESS_REVOKED" as const };
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)))
      .for("update");
    if (!asset)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Content metadata has not reached the server yet.",
      });
    if (asset.state === "expired" || asset.cleanupAfter)
      return { code: "ITEM_DELETED" as const };
    if (asset.verifiedAt) return { code: "VERIFIED" as const };
    if (asset.uploaderUserId !== user.id || !asset.uploadChecksum)
      throw new TRPCError({ code: "FORBIDDEN" });
    await tx
      .update(mediaAssets)
      .set({ uploadExpiresAt: new Date(Date.now() + 900_000) })
      .where(eq(mediaAssets.id, asset.id));
    const ticket = await presignPut(
      asset.storageKey,
      asset.contentType,
      asset.byteSize,
      asset.uploadChecksum,
    );
    return { code: "UPLOAD" as const, uploadUrl: ticket.url };
  });
}

export async function nativeConfirmUpload(
  user: CurrentUser,
  homeId: string,
  assetId: string,
  database: typeof db = db,
) {
  const result = await database.transaction(async (tx) => {
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
    if (!member) return { code: "ACCESS_REVOKED" as const };
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)))
      .for("update");
    if (!asset || asset.state === "expired" || asset.cleanupAfter)
      return { code: "ITEM_DELETED" as const };
    if (asset.verifiedAt) return { code: "VERIFIED" as const };
    if (asset.uploaderUserId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN" });
    const object = await inspectObject(asset.storageKey);
    if (
      !object ||
      object.byteSize !== asset.byteSize ||
      object.contentType !== asset.contentType
    )
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Original bytes do not match the reserved upload.",
      });
    await tx
      .update(mediaAssets)
      .set({ state: "attached", verifiedAt: new Date() })
      .where(eq(mediaAssets.id, asset.id));
    await recordMediaWork(tx, { homeId, assetId, kind: "process-media" });
    return { code: "VERIFIED" as const };
  });
  if (result.code === "VERIFIED") void dispatchMediaWork().catch(() => {});
  return result;
}

export async function nativeMediaUrl(
  user: CurrentUser,
  homeId: string,
  assetId: string,
  variant: "original" | "thumbnail" | "poster",
) {
  const [member] = await db
    .select()
    .from(homeMemberships)
    .where(
      and(
        eq(homeMemberships.homeId, homeId),
        eq(homeMemberships.userId, user.id),
      ),
    );
  if (!member)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access to this home was removed.",
    });
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.homeId, homeId)));
  if (!asset || asset.state !== "attached")
    throw new TRPCError({ code: "NOT_FOUND" });
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(
      and(
        eq(posts.mediaAssetId, assetId),
        eq(boards.homeId, homeId),
        isNull(posts.deletedAt),
      ),
    )
    .limit(1);
  const [reel] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(
      and(
        eq(reels.mediaAssetId, assetId),
        eq(reels.homeId, homeId),
        isNull(reels.deletedAt),
      ),
    )
    .limit(1);
  const [entry] = await db
    .select({ id: bookEntries.id })
    .from(bookEntries)
    .where(
      and(
        eq(bookEntries.mediaAssetId, assetId),
        eq(bookEntries.homeId, homeId),
        isNull(bookEntries.deletedAt),
      ),
    )
    .limit(1);
  if (!post && !reel && !entry) throw new TRPCError({ code: "NOT_FOUND" });
  const key =
    variant === "original"
      ? asset.storageKey
      : variant === "thumbnail"
        ? (asset.thumbnailKey ?? asset.storageKey)
        : asset.posterKey;
  return {
    url: key ? await viewUrl(key) : null,
    contentType: variant === "original" ? asset.contentType : "image/jpeg",
  };
}
