"use client";

import { AttachmentTable, column, Schema, Table } from "@powersync/common";

export const offlineSchema = new Schema({
  account_profile: new Table(
    { email: column.text, display_name: column.text },
    { localOnly: true },
  ),
  discarded_media: new Table({ created_at: column.text }, { localOnly: true }),
  access_notices: new Table({ notified: column.integer }, { localOnly: true }),
  sync_diagnostics: new Table(
    {
      stage: column.text,
      code: column.text,
      operation_id: column.text,
      created_at: column.text,
    },
    { localOnly: true },
  ),
  media_failures: new Table(
    { attempts: column.integer, retry_at: column.integer, code: column.text },
    { localOnly: true },
  ),
  attachments: new AttachmentTable(),
  media_views: new Table(
    {
      last_viewed: column.integer,
      visible: column.integer,
      requested: column.integer,
    },
    { localOnly: true },
  ),
  note_revisions: new Table({
    post_id: column.text,
    revision: column.integer,
    text: column.text,
    foreground_color: column.text,
    background_color: column.text,
    created_at: column.text,
  }),
  media_assets: new Table(
    {
      home_id: column.text,
      kind: column.text,
      state: column.text,
      storage_key: column.text,
      content_type: column.text,
      byte_size: column.integer,
      thumbnail_key: column.text,
      poster_key: column.text,
    },
    { trackMetadata: true },
  ),
  reels: new Table(
    {
      home_id: column.text,
      media_asset_id: column.text,
      creator_user_id: column.text,
      revision: column.integer,
      deleted_at: column.text,
      created_at: column.text,
    },
    { trackMetadata: true },
  ),
  book_entries: new Table(
    {
      home_id: column.text,
      media_asset_id: column.text,
      archived_at: column.text,
      revision: column.integer,
      deleted_at: column.text,
    },
    { trackMetadata: true },
  ),
  homes: new Table({ name: column.text, creator_user_id: column.text }),
  boards: new Table({
    home_id: column.text,
    kind: column.text,
    post_additions: column.integer,
  }),
  posts: new Table(
    {
      board_id: column.text,
      creator_user_id: column.text,
      kind: column.text,
      text_content: column.text,
      media_asset_id: column.text,
      foreground_color: column.text,
      background_color: column.text,
      position_x: column.real,
      position_y: column.real,
      revision: column.integer,
      deleted_at: column.text,
      created_at: column.text,
      updated_at: column.text,
    },
    { trackMetadata: true, indexes: { board: ["board_id"] } },
  ),
  // Never uploaded. Persist policy state before completing a rejected
  // PowerSync transaction so closing the app cannot erase recovery text.
  note_outcomes: new Table(
    {
      home_id: column.text,
      post_id: column.text,
      code: column.text,
      operation_json: column.text,
      outcome_json: column.text,
      created_at: column.text,
    },
    { localOnly: true },
  ),
  note_pending: new Table(
    { home_id: column.text, post_id: column.text },
    { localOnly: true },
  ),
  revoked_homes: new Table({ notified: column.integer }, { localOnly: true }),
});

export async function accountDatabaseFilename(
  accountId: string,
): Promise<string> {
  if (!accountId)
    throw new Error(
      "An authenticated account is required to open local storage.",
    );
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accountId),
  );
  return `noted-${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}.sqlite`;
}
