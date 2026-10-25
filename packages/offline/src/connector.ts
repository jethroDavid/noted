"use client";

import type { NoteOperation, NoteOutcome } from "@noted/validators/sync";
import { noteOperationSchema, noteOutcomeSchema } from "@noted/validators/sync";
import type {
  CommonPowerSyncDatabase,
  PowerSyncBackendConnector,
} from "@powersync/common";

export interface NoteSyncTransport {
  // The shell binds a typed tRPC client and credentials to one account.
  fetchCredentials(): Promise<{ endpoint: string; token: string }>;
  applyNote(operation: NoteOperation): Promise<NoteOutcome>;
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
        if (entry.table !== "posts" || !entry.metadata)
          throw new Error(
            "Unsupported queued operation; update or repair the app before syncing.",
          );
        const operation = noteOperationSchema.parse(JSON.parse(entry.metadata));
        if (entry.id !== operation.postId)
          throw new Error("Queued operation does not match its note.");
        assertActive();
        const revoked = await database.getOptional(
          "SELECT id FROM revoked_homes WHERE id = ?",
          [operation.homeId],
        );
        const result = revoked
          ? { code: "ACCESS_REVOKED" as const }
          : await transport.applyNote(operation);
        const outcome = noteOutcomeSchema.parse(result);
        assertActive();
        await database.writeTransaction(async (tx) => {
          if (outcome.code === "ACCESS_REVOKED") {
            await tx.execute(
              "INSERT OR IGNORE INTO revoked_homes (id, notified) VALUES (?, 0)",
              [operation.homeId],
            );
            // Recovery copies belonging to the revoked home follow the
            // same discard policy. No note text enters the notice.
            await tx.execute("DELETE FROM note_outcomes WHERE home_id = ?", [
              operation.homeId,
            ]);
          } else if (outcome.code !== "ACCEPTED") {
            await tx.execute(
              `INSERT OR REPLACE INTO note_outcomes
              (id, home_id, post_id, code, operation_json, outcome_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                operation.operationId,
                operation.homeId,
                operation.postId,
                outcome.code,
                JSON.stringify(operation),
                JSON.stringify(outcome),
                new Date().toISOString(),
              ],
            );
          }
        });
      }
      // Transport exceptions keep the transaction pending. Terminal domain
      // outcomes have already been handled durably and can leave the queue.
      await transaction.complete();
    },
  };
}
