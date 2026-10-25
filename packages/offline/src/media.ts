"use client";

import { mediaOperationSchema } from "@noted/validators/sync";
import type { MediaOperation } from "@noted/validators/sync";
import type { CommonPowerSyncDatabase, Transaction } from "@powersync/common";

export async function writeMediaOperation(
  tx: Transaction,
  input: MediaOperation,
) {
  const op = mediaOperationSchema.parse(input),
    now = new Date().toISOString(),
    metadata = JSON.stringify(op);
  if (
    await tx.getOptional("SELECT id FROM revoked_homes WHERE id=?", [op.homeId])
  )
    throw Error("Access to this home was removed.");
  await tx.execute(
    "INSERT INTO note_pending (id,home_id,post_id) VALUES (?,?,?)",
    [op.operationId, op.homeId, op.itemId],
  );
  if (op.kind === "restore-photo") {
    const entry = await tx.getOptional<{ media_asset_id: string }>(
      "SELECT media_asset_id FROM book_entries WHERE id=? AND home_id=? AND deleted_at IS NULL",
      [op.archivedItemId, op.homeId],
    );
    if (!entry) throw Error("Archived photo is no longer available.");
    await tx.execute(
      "INSERT INTO posts (id,board_id,kind,media_asset_id,position_x,position_y,revision,created_at,updated_at,_metadata) VALUES (?,?,'photo',?,?,?,0,?,?,?)",
      [
        op.itemId,
        op.boardId,
        entry.media_asset_id,
        op.x,
        op.y,
        now,
        now,
        metadata,
      ],
    );
    await tx.execute(
      "UPDATE book_entries SET deleted_at=?,_metadata=? WHERE id=?",
      [now, metadata, op.archivedItemId],
    );
    return;
  }
  if (op.kind === "create-photo" || op.kind === "create-video") {
    await tx.execute(
      "INSERT INTO media_assets (id,home_id,kind,state,content_type,byte_size,_metadata) VALUES (?,?,?,'pending',?,?,?)",
      [
        op.assetId,
        op.homeId,
        op.upload.kind,
        op.upload.contentType,
        op.upload.byteSize,
        metadata,
      ],
    );
    if (op.kind === "create-photo")
      await tx.execute(
        "INSERT INTO posts (id,board_id,kind,media_asset_id,position_x,position_y,revision,created_at,updated_at,_metadata) VALUES (?,?,'photo',?,?,?,0,?,?,?)",
        [op.itemId, op.boardId, op.assetId, op.x, op.y, now, now, metadata],
      );
    else
      await tx.execute(
        "INSERT INTO reels (id,home_id,media_asset_id,revision,created_at,_metadata) VALUES (?,?,?,0,?,?)",
        [op.itemId, op.homeId, op.assetId, now, metadata],
      );
    return;
  }
  const table =
    op.kind === "archive-video"
      ? "reels"
      : op.kind === "delete-book"
        ? "book_entries"
        : "posts";
  const row = await tx.getOptional<{ media_asset_id: string }>(
    `SELECT media_asset_id FROM ${table} WHERE id=? AND deleted_at IS NULL`,
    [op.itemId],
  );
  if (!row) throw Error("This item is no longer available on this device.");
  if (op.kind === "move-photo")
    await tx.execute(
      "UPDATE posts SET position_x=?,position_y=?,updated_at=?,_metadata=? WHERE id=?",
      [op.x, op.y, now, metadata, op.itemId],
    );
  else {
    await tx.execute(
      `UPDATE ${table} SET deleted_at=?,_metadata=? WHERE id=?`,
      [now, metadata, op.itemId],
    );
    if (op.kind !== "delete-book")
      await tx.execute(
        "INSERT OR IGNORE INTO book_entries (id,home_id,media_asset_id,archived_at,revision,_metadata) VALUES (?,?,?,?,0,?)",
        [op.itemId, op.homeId, row.media_asset_id, now, metadata],
      );
  }
}
export async function saveMediaOperation(
  database: CommonPowerSyncDatabase,
  operation: MediaOperation,
) {
  await database.writeTransaction((tx) => writeMediaOperation(tx, operation));
}
