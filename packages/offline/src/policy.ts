"use client";

import type { Transaction } from "@powersync/common";

export async function markHomeRevoked(tx: Transaction, homeId: string) {
  await tx.execute(
    "INSERT OR IGNORE INTO revoked_homes (id,notified) VALUES (?,0)",
    [homeId],
  );
  await tx.execute(
    "INSERT OR REPLACE INTO access_notices (id,notified) VALUES (?,0)",
    [homeId],
  );
  await tx.execute("DELETE FROM note_outcomes WHERE home_id=?", [homeId]);
  await tx.execute("DELETE FROM note_pending WHERE home_id=?", [homeId]);
}
