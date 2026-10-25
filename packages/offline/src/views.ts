"use client";

import {
  boardPostsResponseSchema,
  bookResponseSchema,
  homeResponseSchema,
  reelsResponseSchema,
} from "@noted/validators/src";
import type { CommonPowerSyncDatabase } from "@powersync/common";

type Database = CommonPowerSyncDatabase;
async function pendingState(db: Database) {
  const targets = new Set(
    (
      await db.getAll<{ post_id: string }>("SELECT post_id FROM note_pending")
    ).map((row) => row.post_id),
  );
  const originals = new Set(
    (
      await db.getAll<{ id: string }>(
        "SELECT id FROM attachments WHERE state=0 AND has_synced=0",
      )
    ).map((row) => row.id),
  );
  return (id: string, assetId?: string) =>
    targets.has(id) || Boolean(assetId && originals.has(assetId));
}
export async function localHome(db: Database, homeId: string) {
  const home = await db.getOptional<{
    id: string;
    name: string;
    creator_user_id: string;
    board_id: string;
  }>(
    "SELECT h.*,b.id AS board_id FROM homes h JOIN boards b ON b.home_id=h.id WHERE h.id=? AND NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id=h.id)",
    [homeId],
  );
  if (!home) throw Error("This home is not available on this device.");
  return homeResponseSchema.parse({
    home: {
      id: home.id,
      name: home.name,
      creatorUserId: home.creator_user_id,
      boardId: home.board_id,
      role: "member",
      members: [],
      pendingInvitations: [],
    },
  });
}
export async function localPost(db: Database, homeId: string, postId: string) {
  await localHome(db, homeId);
  const row = await db.getOptional<{
    id: string;
    board_id: string;
    kind: string;
    revision: number;
    media_asset_id: string;
  }>(
    "SELECT p.* FROM posts p JOIN boards b ON b.id=p.board_id WHERE p.id=? AND b.home_id=? AND p.deleted_at IS NULL",
    [postId, homeId],
  );
  if (!row) throw Error("This item is no longer available.");
  return row;
}
type Row = {
  id: string;
  kind: string;
  text_content: string;
  foreground_color: string;
  background_color: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
  media_asset_id: string;
  content_type: string;
  revision: number;
};
type Url = (assetId: string, type: string) => Promise<string | null>;
export async function localBoard(
  db: Database,
  homeId: string,
  boardId: string,
  url: Url,
) {
  const pending = await pendingState(db);
  const { home } = await localHome(db, homeId);
  if (home.boardId !== boardId)
    throw Error("Board does not belong to this home.");
  const rows = await db.getAll<Row>(
    "SELECT p.*,a.content_type FROM posts p LEFT JOIN media_assets a ON a.id=p.media_asset_id WHERE p.board_id=? AND p.deleted_at IS NULL ORDER BY p.updated_at,p.id",
    [boardId],
  );
  const items = await Promise.all(
    rows.map(async (row) => {
      const base = {
        pending: pending(row.id, row.media_asset_id),
        id: row.id,
        boardId,
        x: row.position_x,
        y: row.position_y,
        revision: Math.max(1, row.revision),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
      if (row.kind === "text")
        return {
          ...base,
          kind: "text",
          text: row.text_content,
          foregroundColor: row.foreground_color,
          backgroundColor: row.background_color,
        };
      const imageUrl = await url(row.media_asset_id, row.content_type);
      return {
        ...base,
        assetId: row.media_asset_id,
        unavailable: !imageUrl,
        kind: "photo",
        status: imageUrl ? "ready" : "processing",
        imageUrl,
        thumbnailUrl: imageUrl,
      };
    }),
  );
  return boardPostsResponseSchema.parse({
    board: { id: boardId, homeId, postAdditions: 0 },
    posts: items,
    serverTime: new Date(),
  });
}
export async function localReels(db: Database, homeId: string, url: Url) {
  const pending = await pendingState(db);
  await localHome(db, homeId);
  const rows = await db.getAll<{
    id: string;
    revision: number;
    media_asset_id: string;
    content_type: string;
    created_at: string;
  }>(
    "SELECT r.*,a.content_type FROM reels r JOIN media_assets a ON a.id=r.media_asset_id WHERE r.home_id=? AND r.deleted_at IS NULL ORDER BY r.created_at DESC",
    [homeId],
  );
  return reelsResponseSchema.parse({
    reels: await Promise.all(
      rows.map(async (row) => {
        const videoUrl = await url(row.media_asset_id, row.content_type);
        return {
          id: row.id,
          pending: pending(row.id, row.media_asset_id),
          assetId: row.media_asset_id,
          homeId,
          revision: Math.max(1, row.revision),
          status: videoUrl ? "ready" : "processing",
          unavailable: !videoUrl,
          videoUrl,
          posterUrl: null,
          createdAt: new Date(row.created_at),
          expiresAt: null,
        };
      }),
    ),
  });
}
export const missingMediaImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="#f7f2e7"/><text x="50%" y="50%" text-anchor="middle" fill="#394b38" font-size="16">Connect to download this memory</text></svg>',
  );
export async function localBook(db: Database, homeId: string, url: Url) {
  const pending = await pendingState(db);
  await localHome(db, homeId);
  const rows = await db.getAll<{
    id: string;
    revision: number;
    media_asset_id: string;
    kind: string;
    content_type: string;
    archived_at: string;
  }>(
    "SELECT b.*,a.kind,a.content_type FROM book_entries b JOIN media_assets a ON a.id=b.media_asset_id WHERE b.home_id=? AND b.deleted_at IS NULL ORDER BY b.archived_at",
    [homeId],
  );
  return bookResponseSchema.parse({
    entries: await Promise.all(
      rows.map(async (row) => {
        const original = await url(row.media_asset_id, row.content_type);
        const base = {
          pending: pending(row.id, row.media_asset_id),
          id: row.id,
          assetId: row.media_asset_id,
          revision: Math.max(1, row.revision),
          archivedAt: new Date(row.archived_at),
          unavailable: !original,
        };
        return row.kind === "photo"
          ? {
              ...base,
              kind: "photo",
              imageUrl: original ?? missingMediaImage,
              thumbnailUrl: original ?? missingMediaImage,
            }
          : {
              ...base,
              kind: "clip",
              videoUrl: original ?? "data:video/mp4;base64,",
              posterUrl: original ? null : missingMediaImage,
            };
      }),
    ),
  });
}
