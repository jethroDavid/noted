"use client";

import type { NoteOperation } from "@noted/validators/sync";
import { noteOperationSchema } from "@noted/validators/sync";
import type { CommonPowerSyncDatabase } from "@powersync/common";

export async function saveNoteOperation(
  database: CommonPowerSyncDatabase,
  input: NoteOperation,
): Promise<void> {
  const operation = noteOperationSchema.parse(input);
  const now = new Date().toISOString();
  const metadata = JSON.stringify(operation);
  await database.writeTransaction(async (tx) => {
    const revoked = await tx.getOptional(
      "SELECT id FROM revoked_homes WHERE id = ?",
      [operation.homeId],
    );
    if (revoked) throw new Error("Access to this home was removed.");
    if (operation.kind === "create") {
      const existing = await tx.getOptional(
        "SELECT id FROM posts WHERE id = ?",
        [operation.postId],
      );
      if (existing) throw new Error("That note already exists on this device.");
      await tx.execute(
        "INSERT INTO note_pending (id, home_id, post_id) VALUES (?, ?, ?)",
        [operation.operationId, operation.homeId, operation.postId],
      );
      await tx.execute(
        `INSERT INTO posts
        (id, board_id, kind, text_content, foreground_color, background_color, position_x, position_y, revision, created_at, updated_at, _metadata)
        VALUES (?, ?, 'text', ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          operation.postId,
          operation.boardId,
          operation.value.text,
          operation.value.foregroundColor,
          operation.value.backgroundColor,
          operation.value.x,
          operation.value.y,
          now,
          now,
          metadata,
        ],
      );
      return;
    }
    const post = await tx.getOptional(
      "SELECT id FROM posts WHERE id = ? AND board_id = ? AND kind = 'text' AND deleted_at IS NULL",
      [operation.postId, operation.boardId],
    );
    if (!post)
      throw new Error("This note is not available for editing on this device.");
    await tx.execute(
      "INSERT INTO note_pending (id, home_id, post_id) VALUES (?, ?, ?)",
      [operation.operationId, operation.homeId, operation.postId],
    );
    if (operation.kind === "edit") {
      const columns = {
        text: "text_content",
        foregroundColor: "foreground_color",
        backgroundColor: "background_color",
      } as const;
      const entries = Object.entries(operation.patch) as [
        keyof typeof columns,
        string,
      ][];
      await tx.execute(
        `UPDATE posts SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")}, updated_at = ?, _metadata = ? WHERE id = ?`,
        [...entries.map(([, value]) => value), now, metadata, operation.postId],
      );
    } else if (operation.kind === "move") {
      await tx.execute(
        "UPDATE posts SET position_x = ?, position_y = ?, updated_at = ?, _metadata = ? WHERE id = ?",
        [operation.x, operation.y, now, metadata, operation.postId],
      );
    } else {
      await tx.execute(
        "UPDATE posts SET deleted_at = ?, updated_at = ?, _metadata = ? WHERE id = ?",
        [now, now, metadata, operation.postId],
      );
    }
  });
}

export interface LocalTextNote {
  id: string;
  board_id: string;
  text_content: string;
  foreground_color: string;
  background_color: string;
  position_x: number;
  position_y: number;
  revision: number;
}

export const visibleNotesSql = `SELECT p.* FROM posts p
  WHERE p.board_id = ? AND p.kind = 'text' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id = ?)
  ORDER BY p.updated_at, p.id`;
