"use client";

import { offlineSchema } from "@noted/offline/src";
import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";

export function createDesktopDatabase(dbFilename: string) {
  return new PowerSyncDatabase({
    schema: offlineSchema,
    database: {
      dbFilename,
      vfs: WASQLiteVFS.AccessHandlePoolVFS,
      enableMultiTabs: false,
    },
  });
}
