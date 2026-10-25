"use client";

import type {
  MediaOperation,
  NoteOperation,
  NoteOutcome,
} from "@noted/validators/sync";
import {
  mediaOperationSchema,
  noteOperationSchema,
  noteOutcomeSchema,
} from "@noted/validators/sync";
import type {
  CommonPowerSyncDatabase,
  PowerSyncBackendConnector,
} from "@powersync/common";
import { diagnostic } from "./diagnostics";
import { markHomeRevoked } from "./policy";

export interface NoteSyncTransport {
  // The shell binds a typed tRPC client and credentials to one account.
  fetchCredentials(): Promise<{ endpoint: string; token: string }>;
  applyNote(operation: NoteOperation): Promise<NoteOutcome>;
  applyMedia?(operation: MediaOperation): Promise<NoteOutcome>;
  isActive(): boolean;
}

export function createNoteConnector(
  transport: NoteSyncTransport,
): PowerSyncBackendConnector {
  function assertActive() {
    if (!transport.isActive())
      throw new Error("This account's synchronization is paused.");
  }
  return {
    async fetchCredentials() {
      assertActive();
      const credentials = await transport.fetchCredentials();
      assertActive();
      return credentials;
    },
    async uploadData(database: CommonPowerSyncDatabase) {
      assertActive();
      const transaction = await database.getNextCrudTransaction();
      if (!transaction) return;
      for (const entry of transaction.crud) {
        // Missing context is a bug/incompatible client, never a reason to
        // acknowledge and lose the operation.
        if (
          !["posts", "media_assets", "reels", "book_entries"].includes(
            entry.table,
          ) ||
          !entry.metadata
        )
          throw new Error(
            "Unsupported queued operation; update or repair the app before syncing.",
          );
        const raw = JSON.parse(entry.metadata);
        const media = mediaOperationSchema.safeParse(raw);
        const operation = media.success
          ? media.data
          : noteOperationSchema.parse(raw);
        const itemId =
          "postId" in operation ? operation.postId : operation.itemId;
        if (
          entry.id !== itemId &&
          !("assetId" in operation && entry.id === operation.assetId) &&
          !(
            "archivedItemId" in operation &&
            entry.id === operation.archivedItemId
          )
        )
          throw new Error("Queued operation does not match its note.");
        assertActive();
        const revoked = await database.getOptional(
          "SELECT id FROM revoked_homes WHERE id = ?",
          [operation.homeId],
        );
        const result = revoked
          ? { code: "ACCESS_REVOKED" as const }
          : "postId" in operation
            ? await transport.applyNote(operation)
            : transport.applyMedia
              ? await transport.applyMedia(operation)
              : (() => {
                  throw new Error("Media synchronization is not configured.");
                })();
        const outcome = noteOutcomeSchema.parse(result);
        assertActive();
        await database.writeTransaction(async (tx) => {
          await diagnostic(tx, "metadata", outcome.code, operation.operationId);
          if (outcome.code === "ACCESS_REVOKED") {
            await markHomeRevoked(tx, operation.homeId);
          } else if (outcome.code !== "ACCEPTED") {
            await tx.execute(
              `INSERT OR REPLACE INTO note_outcomes
              (id, home_id, post_id, code, operation_json, outcome_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                operation.operationId,
                operation.homeId,
                itemId,
                outcome.code,
                JSON.stringify(operation),
                JSON.stringify(outcome),
                new Date().toISOString(),
              ],
            );
          }
          await tx.execute("DELETE FROM note_pending WHERE id = ?", [
            operation.operationId,
          ]);
        });
      }
      // Transport exceptions keep the transaction pending. Terminal domain
      // outcomes have already been handled durably and can leave the queue.
      await transaction.complete();
    },
  };
}
