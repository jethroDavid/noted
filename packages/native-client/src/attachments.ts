"use client";

import {
  diagnostic,
  markHomeRevoked,
  writeMediaOperation,
} from "@noted/offline/src";
import { requestUploadSchema } from "@noted/validators/src";
import type { MediaOperation } from "@noted/validators/sync";
import { AttachmentQueue, AttachmentState } from "@powersync/common";
import type {
  AttachmentRecord,
  CommonPowerSyncDatabase,
} from "@powersync/common";
import { TRPCClientError } from "@trpc/client";
import type { nativeApi } from "./session";
import type { NativeMediaStorage } from "./storage";

type Client = ReturnType<typeof nativeApi>;
class RetryDeferred extends Error {}
const extension = (type: string) =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
  })[type] ?? "bin";
export function createAttachments(
  database: CommonPowerSyncDatabase,
  storage: NativeMediaStorage,
  client: Client,
  isActive: () => boolean,
  apiUrl: string,
  budgetBytes = 256 * 1024 * 1024,
) {
  const urls = new Map<string, string>();
  const blockedAssets = new Set<string>();
  const assertActive = () => {
    if (!isActive()) throw Error("This account is paused.");
  };
  const metadata = (attachment: AttachmentRecord) =>
    JSON.parse(attachment.metaData ?? "{}") as {
      homeId: string;
      checksum?: string;
      operation?: MediaOperation;
    };
  async function retryReady(id: string) {
    const row = await database.getOptional<{ retry_at: number }>(
      "SELECT retry_at FROM media_failures WHERE id=?",
      [id],
    );
    if (row && row.retry_at > Date.now())
      throw new RetryDeferred("Media retry is waiting for backoff.");
  }
  async function failed(
    stage: string,
    attachment: AttachmentRecord,
    error: unknown,
  ) {
    if (error instanceof RetryDeferred) return true;
    const code =
      error instanceof TRPCClientError
        ? (error.data?.code ?? "TRANSFER_FAILED")
        : error instanceof Error &&
            ["ACCESS_REVOKED", "ITEM_DELETED"].includes(error.message)
          ? error.message
          : "TRANSFER_FAILED";
    await database.writeTransaction(async (tx) => {
      if (stage === "media-download" && code === "FORBIDDEN")
        await markHomeRevoked(tx, metadata(attachment).homeId);
      const row = await tx.getOptional<{ attempts: number }>(
        "SELECT attempts FROM media_failures WHERE id=?",
        [attachment.id],
      );
      const attempts = (row?.attempts ?? 0) + 1;
      await tx.execute(
        "INSERT OR REPLACE INTO media_failures (id,attempts,retry_at,code) VALUES (?,?,?,?)",
        [
          attachment.id,
          attempts,
          Date.now() +
            Math.min(3600_000, 10_000 * 2 ** Math.min(attempts - 1, 9)),
          code,
        ],
      );
      await diagnostic(
        tx,
        stage,
        code,
        metadata(attachment).operation?.operationId,
      );
    });
    return true;
  }
  async function succeeded(id: string) {
    await database.execute("DELETE FROM media_failures WHERE id=?", [id]);
  }
  const problem = async (attachment: AttachmentRecord, code: string) => {
    const meta = metadata(attachment);
    if (code === "ACCESS_REVOKED") {
      await database.writeTransaction((tx) => markHomeRevoked(tx, meta.homeId));
    } else if (meta.operation) {
      await database.execute(
        "INSERT OR REPLACE INTO note_outcomes (id,home_id,post_id,code,operation_json,outcome_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          meta.operation.operationId,
          meta.homeId,
          meta.operation.itemId,
          code,
          JSON.stringify(meta.operation),
          JSON.stringify({ code }),
          new Date().toISOString(),
        ],
      );
    }
    throw Error(code);
  };
  const budgetedStorage: NativeMediaStorage = Object.create(storage);
  budgetedStorage.saveFile = async function (
    uri: string,
    data: ArrayBuffer | string,
  ) {
    if ([...blockedAssets].some((id) => uri.includes(id)))
      throw Error("ACCESS_REVOKED");
    if (typeof data === "string") throw Error("Expected binary media.");
    const save = async () => {
      await reserveBytes(data.byteLength);
      return storage.saveFile(uri, data);
    };
    return navigator.locks
      ? navigator.locks.request("noted-media-budget", save)
      : save();
  };
  const queue = new AttachmentQueue({
    db: database,
    localStorage: budgetedStorage,
    archivedCacheLimit: Number.MAX_SAFE_INTEGER,
    syncIntervalMs: 10_000,
    errorHandler: {
      onUploadError: (attachment, error) =>
        failed("original-upload", attachment, error),
      onDownloadError: (attachment, error) =>
        failed("media-download", attachment, error),
      onDeleteError: (attachment, error) =>
        failed("local-discard", attachment, error),
    },
    transportAdapter: {
      async upload(attachment) {
        assertActive();
        await retryReady(attachment.id);
        const meta = metadata(attachment);
        const ticket = await client.sync.uploadTicket.mutate({
          homeId: meta.homeId,
          assetId: attachment.id,
        });
        assertActive();
        if (ticket.code === "ACCESS_REVOKED" || ticket.code === "ITEM_DELETED")
          return problem(attachment, ticket.code);
        if (ticket.code === "UPLOAD") {
          const headers = {
            "content-type": attachment.mediaType ?? "application/octet-stream",
            "x-amz-checksum-sha256": meta.checksum ?? "",
          };
          if (storage.upload)
            await storage.upload(
              attachment.localUri,
              ticket.uploadUrl,
              headers,
            );
          else {
            const response = await fetch(ticket.uploadUrl, {
              method: "PUT",
              headers,
              body: await storage.readFile(attachment.localUri),
            });
            if (!response.ok)
              throw Error(`Original transfer failed (${response.status}).`);
          }
          assertActive();
          const result = await client.sync.confirmMedia.mutate({
            homeId: meta.homeId,
            assetId: attachment.id,
          });
          assertActive();
          if (result.code !== "VERIFIED")
            return problem(attachment, result.code);
        }
        await succeeded(attachment.id);
      },
      async download(attachment) {
        assertActive();
        await retryReady(attachment.id);
        const meta = metadata(attachment);
        const result = await client.sync.mediaUrl.query({
          homeId: meta.homeId,
          assetId: attachment.id,
          variant: "original",
        });
        const asset = await database.get<{ byte_size: number }>(
          "SELECT byte_size FROM media_assets WHERE id=?",
          [attachment.id],
        );
        await reserveBytes(asset.byte_size);
        if (!result.url) throw Error("Media is not ready.");
        if (storage.download) {
          await storage.download(
            attachment.localUri,
            new URL(result.url, apiUrl).href,
            asset.byte_size,
          );
          try {
            await reserveBytes(0);
          } catch (error) {
            await storage.deleteFile(attachment.localUri);
            throw error;
          }
        } else {
          const response = await fetch(new URL(result.url, apiUrl));
          if (!response.ok)
            throw Error(`Media download failed (${response.status}).`);
          await budgetedStorage.saveFile(
            attachment.localUri,
            await response.arrayBuffer(),
          );
        }
        if (blockedAssets.has(attachment.id)) {
          await storage.deleteFile(attachment.localUri);
          throw Error("ACCESS_REVOKED");
        }
        assertActive();
        await succeeded(attachment.id);
      },
      // Canonical lifecycle and the delayed server sweeper own remote deletion.
      async delete() {
        assertActive();
      },
    },
    watchAttachments(onUpdate, signal) {
      void (async () => {
        const sql = `SELECT DISTINCT a.id,a.home_id,a.content_type FROM media_assets a WHERE NOT EXISTS (SELECT 1 FROM discarded_media WHERE id=a.id) AND NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id=a.home_id) AND EXISTS (SELECT 1 FROM media_views v WHERE v.id=a.id AND v.requested=1) AND (
      EXISTS (SELECT 1 FROM posts p WHERE p.media_asset_id=a.id AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM reels r WHERE r.media_asset_id=a.id AND r.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM book_entries b WHERE b.media_asset_id=a.id AND b.deleted_at IS NULL))`;
        for await (const result of database.watch(sql, [], { signal })) {
          const rows = (result.rows?._array ?? []) as {
            id: string;
            home_id: string;
            content_type: string;
          }[];
          await onUpdate(
            rows.map((a) => ({
              id: a.id,
              fileExtension: extension(a.content_type),
              mediaType: a.content_type,
              metaData: JSON.stringify({ homeId: a.home_id }),
            })),
          );
        }
      })().catch((error) => {
        if (!signal.aborted) console.error("Media watch failed", error);
      });
    },
  });
  async function save(input: {
    homeId: string;
    boardId?: string;
    file: File;
    x?: number;
    y?: number;
  }) {
    assertActive();
    await reserveBytes(input.file.size);
    const bytes = await input.file.arrayBuffer();
    const checksum = btoa(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ),
    );
    const assetId = crypto.randomUUID(),
      itemId = crypto.randomUUID();
    const upload = {
      homeId: input.homeId,
      kind: input.boardId ? ("photo" as const) : ("video" as const),
      contentType: input.file.type,
      byteSize: input.file.size,
      checksum,
    };
    const operation: MediaOperation = input.boardId
      ? {
          kind: "create-photo",
          operationId: crypto.randomUUID(),
          homeId: input.homeId,
          boardId: input.boardId,
          assetId,
          itemId,
          upload,
          x: input.x ?? 0.5,
          y: input.y ?? 0.5,
        }
      : {
          kind: "create-video",
          operationId: crypto.randomUUID(),
          homeId: input.homeId,
          assetId,
          itemId,
          upload,
        };
    requestUploadSchema.parse(upload);
    await queue.saveFile({
      id: assetId,
      fileExtension: extension(input.file.type),
      mediaType: input.file.type,
      data: bytes,
      metaData: JSON.stringify({ homeId: input.homeId, checksum, operation }),
      updateHook: async (tx) => {
        assertActive();
        await writeMediaOperation(tx, operation);
      },
    });
  }
  return {
    queue,
    save,
    async discard(assetId: string, outcomeId: string) {
      await queue.deleteFile({
        id: assetId,
        updateHook: async (tx) => {
          await tx.execute(
            "INSERT OR REPLACE INTO discarded_media (id,created_at) VALUES (?,?)",
            [assetId, new Date().toISOString()],
          );
          await tx.execute("DELETE FROM note_outcomes WHERE id=?", [outcomeId]);
        },
      });
      const url = urls.get(assetId);
      if (url) URL.revokeObjectURL(url);
      urls.delete(assetId);
      await queue.syncStorage();
    },
    async saveAsNew(
      operation: Extract<
        MediaOperation,
        { kind: "create-photo" | "create-video" }
      >,
      outcomeId: string,
    ) {
      const row = await database.get<{ local_uri: string }>(
        "SELECT local_uri FROM attachments WHERE id=?",
        [operation.assetId],
      );
      const file = new File(
        [await storage.readFile(row.local_uri)],
        `recovered.${extension(operation.upload.contentType)}`,
        { type: operation.upload.contentType },
      );
      await save({
        homeId: operation.homeId,
        file,
        ...(operation.kind === "create-photo"
          ? { boardId: operation.boardId, x: operation.x, y: operation.y }
          : {}),
      });
      await this.discard(operation.assetId, outcomeId);
    },
    async view(assetId: string, visible: boolean) {
      await database.execute(
        "INSERT INTO media_views (id,last_viewed,visible,requested) VALUES (?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_viewed=excluded.last_viewed,visible=excluded.visible,requested=CASE WHEN excluded.visible=1 THEN 1 ELSE requested END",
        [assetId, Date.now(), visible ? 1 : 0],
      );
    },
    async initialize() {
      await storage.initialize();
      await database.execute("UPDATE media_views SET visible=0");
      const records = await database.getAll<{ local_uri: string }>(
        "SELECT local_uri FROM attachments WHERE local_uri IS NOT NULL",
      );
      for (const file of await storage.files())
        if (
          file.modified < Date.now() - 3600_000 &&
          !records.some((row) => row.local_uri === file.uri)
        )
          await storage.deleteFile(file.uri);
    },
    async purgeRevoked() {
      const homes = await database.getAll<{ id: string }>(
        "SELECT id FROM revoked_homes",
      );
      if (!homes.length) return;
      await queue.withAttachmentContext(async (context) => {
        for (const attachment of await context.getAttachments()) {
          const meta = metadata(attachment);
          if (!homes.some((home) => home.id === meta.homeId)) continue;
          blockedAssets.add(attachment.id);
          if (attachment.localUri)
            await storage.deleteFile(attachment.localUri);
          await context.deleteAttachment(attachment.id);
          await database.execute("DELETE FROM media_views WHERE id=?", [
            attachment.id,
          ]);
          const url = urls.get(attachment.id);
          if (url) URL.revokeObjectURL(url);
          urls.delete(attachment.id);
        }
      });
    },
    async pending() {
      const row = await database.get<{ count: number }>(
        "SELECT count(*) AS count FROM attachments WHERE has_synced=0 AND state=?",
        [AttachmentState.QUEUED_UPLOAD],
      );
      return row.count;
    },
    async localUrl(assetId: string, type: string) {
      if (urls.has(assetId)) return urls.get(assetId)!;
      const row = await database.getOptional<{ local_uri: string }>(
        "SELECT local_uri FROM attachments WHERE id=? AND local_uri IS NOT NULL",
        [assetId],
      );
      if (!row || !(await storage.fileExists(row.local_uri))) return null;
      const url = storage.displayUri
        ? await storage.displayUri(row.local_uri)
        : URL.createObjectURL(
            new Blob([await storage.readFile(row.local_uri)], { type }),
          );
      urls.set(assetId, url);
      return url;
    },
    release() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
  async function reserveBytes(bytes: number) {
    const budget = budgetBytes;
    if (bytes > budget)
      throw Error("This file exceeds the device media budget.");
    const candidates = await database.getAll<{ id: string; local_uri: string }>(
      `SELECT a.id,a.local_uri FROM attachments a LEFT JOIN media_views v ON v.id=a.id WHERE a.has_synced=1 AND a.local_uri IS NOT NULL AND COALESCE(v.visible,0)=0 AND NOT EXISTS (SELECT 1 FROM note_pending n JOIN posts p ON p.id=n.post_id WHERE p.media_asset_id=a.id) AND NOT EXISTS (SELECT 1 FROM note_pending n JOIN reels r ON r.id=n.post_id WHERE r.media_asset_id=a.id) AND NOT EXISTS (SELECT 1 FROM note_pending n JOIN book_entries b ON b.id=n.post_id WHERE b.media_asset_id=a.id) ORDER BY COALESCE(v.last_viewed,0)`,
    );
    for (const candidate of candidates) {
      if ((await storage.usage()) + bytes <= budget) return;
      await queue.withAttachmentContext(async (context) => {
        await database.execute(
          "UPDATE media_views SET requested=0 WHERE id=?",
          [candidate.id],
        );
        await storage.deleteFile(candidate.local_uri);
        const existing = await context.getAttachment(candidate.id);
        if (existing)
          await context.saveAttachments([
            {
              ...existing,
              localUri: undefined,
              state: AttachmentState.ARCHIVED,
            },
          ]);
      });
      const url = urls.get(candidate.id);
      if (url) URL.revokeObjectURL(url);
      urls.delete(candidate.id);
    }
    if ((await storage.usage()) + bytes > budget)
      throw Error(
        "Device storage is full of protected work or another account's files. Sync your pending work or free device storage before saving more media.",
      );
  }
}
export type NativeAttachments = ReturnType<typeof createAttachments>;
