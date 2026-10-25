"use client";

import type { CommonPowerSyncDatabase, Transaction } from "@powersync/common";

export async function diagnostic(
  tx: Transaction,
  stage: string,
  code: string,
  operationId?: string,
) {
  await tx.execute(
    "INSERT INTO sync_diagnostics (id,stage,code,operation_id,created_at) VALUES (?,?,?,?,?)",
    [
      crypto.randomUUID(),
      stage,
      code,
      operationId ?? null,
      new Date().toISOString(),
    ],
  );
  await tx.execute(
    "DELETE FROM sync_diagnostics WHERE id NOT IN (SELECT id FROM sync_diagnostics ORDER BY created_at DESC,id DESC LIMIT 500)",
  );
}
export async function exportDiagnostics(db: CommonPowerSyncDatabase) {
  const events = await db.getAll(
    "SELECT stage,code,operation_id,created_at FROM sync_diagnostics ORDER BY created_at,id",
  );
  return JSON.stringify(
    {
      clientVersion: "native-offline-v1",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      events,
    },
    null,
    2,
  );
}
