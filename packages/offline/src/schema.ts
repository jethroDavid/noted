"use client";

import { column, Schema, Table } from "@powersync/common";

export const offlineSchema = new Schema({
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
