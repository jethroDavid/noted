"use client";

import type { AppRouter } from "@noted/api/src";
import {
  accountDatabaseFilename,
  createNoteConnector,
  markHomeRevoked,
} from "@noted/offline/src";
import { homeIdSchema } from "@noted/validators/src";
import type { CommonPowerSyncDatabase } from "@powersync/common";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import type { Auth, User } from "firebase/auth";
import superjson from "superjson";
import { createAttachments } from "./attachments";
import type { NativeAttachments } from "./attachments";
import type { NativeConfiguration } from "./config";
import type { NativeMediaStorage } from "./storage";

export function requiresSignIn(error: Error | undefined): boolean {
  if (error instanceof TRPCClientError)
    return error.data?.code === "UNAUTHORIZED";
  return Boolean(
    error &&
    "code" in error &&
    [
      "auth/user-token-expired",
      "auth/invalid-user-token",
      "auth/user-disabled",
    ].includes(String(error.code)),
  );
}

export function nativeApi(apiUrl: string, token?: () => Promise<string>) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${apiUrl.replace(/\/$/, "")}/api/trpc`,
        transformer: superjson,
        headers: async () =>
          token ? { authorization: `Bearer ${await token()}` } : {},
      }),
    ],
  });
}

export interface NativeSession {
  accountId: string;
  database: CommonPowerSyncDatabase;
  attachments: NativeAttachments;
  pinHistory(postId: string, month: string): Promise<void>;
  active: boolean;
  pause(): Promise<void>;
  resume(): void;
  retrySync(): Promise<void>;
  close(): Promise<void>;
}

export async function openNativeSession(
  user: User,
  auth: Auth,
  configuration: NativeConfiguration,
  createDatabase: (filename: string) => CommonPowerSyncDatabase,
  createStorage: (scope: string) => NativeMediaStorage,
): Promise<NativeSession> {
  const filename = await accountDatabaseFilename(
    `${configuration.apiUrl}|${user.uid}`,
  );
  const database = createDatabase(filename);
  const watchers = new AbortController();
  const pins = new Map<
    string,
    Awaited<ReturnType<ReturnType<typeof database.syncStream>["subscribe"]>>
  >();
  let closing: Promise<void> | undefined;
  let connect: (() => void) | undefined;
  let scopeTimer: ReturnType<typeof setInterval> | undefined;
  const historyPins = new Map<
    string,
    Awaited<ReturnType<ReturnType<typeof database.syncStream>["subscribe"]>>
  >();
  const mediaPins = new Map<
    string,
    Awaited<ReturnType<ReturnType<typeof database.syncStream>["subscribe"]>>
  >();
  const client = nativeApi(configuration.apiUrl, () => user.getIdToken());
  const isActive = () => session.active && auth.currentUser?.uid === user.uid;
  const session: NativeSession = {
    accountId: user.uid,
    database,
    attachments: createAttachments(
      database,
      createStorage(filename),
      client,
      isActive,
      configuration.apiUrl,
    ),
    async pinHistory(postId, month) {
      const key = `${postId}:${month}`;
      if (historyPins.has(key)) return;
      const pin = await database
        .syncStream("note_history", {
          post_id: postId,
          month,
        })
        .subscribe({ ttl: 604800 });
      if (!isActive()) pin.unsubscribe();
      else historyPins.set(key, pin);
    },
    active: true,
    async pause() {
      session.active = false;
      await session.attachments.queue.stopSync();
      await database.disconnect();
    },
    resume() {
      session.active = true;
      connect?.();
      void session.attachments.queue.startSync();
    },
    async retrySync() {
      if (!isActive()) return;
      if (!database.currentStatus.connected) connect?.();
      await session.attachments.retry();
    },
    close() {
      session.active = false;
      watchers.abort();
      clearInterval(scopeTimer);
      closing ??= (async () => {
        for (const pin of pins.values()) pin.unsubscribe();
        pins.clear();
        for (const pin of historyPins.values()) pin.unsubscribe();
        historyPins.clear();
        for (const pin of mediaPins.values()) pin.unsubscribe();
        mediaPins.clear();
        try {
          await session.attachments.queue.stopSync();
          session.attachments.release();
          await database.disconnect();
        } finally {
          await database.close();
        }
      })();
      return closing;
    },
  };
  try {
    await database.init();
    await session.attachments.initialize();
    const checkScopes = async () => {
      if (!isActive()) return;
      const rows = await database.getAll<{ id: string }>(
        "SELECT id FROM homes UNION SELECT id FROM revoked_homes UNION SELECT home_id AS id FROM note_pending UNION SELECT home_id AS id FROM note_outcomes UNION SELECT home_id AS id FROM media_assets UNION SELECT json_extract(CASE WHEN json_valid(meta_data) THEN meta_data ELSE '{}' END,'$.homeId') AS id FROM attachments",
      );
      const scopesToCheck = rows.filter(
        (row) => homeIdSchema.safeParse(row.id).success,
      );
      for (let offset = 0; offset < scopesToCheck.length; offset += 100) {
        const scopes = await client.sync.scopeStatus.query({
          homeIds: scopesToCheck
            .slice(offset, offset + 100)
            .map((row) => row.id),
        });
        if (!isActive()) return;
        const queueEmpty = (await database.getUploadQueueStats()).count === 0;
        await database.writeTransaction(async (tx) => {
          for (const scope of scopes)
            if (!scope.allowed) {
              await markHomeRevoked(tx, scope.homeId);
            } else if (queueEmpty) {
              await tx.execute("DELETE FROM revoked_homes WHERE id=?", [
                scope.homeId,
              ]);
            }
        });
      }
      await session.attachments.purgeRevoked();
    };
    scopeTimer = setInterval(() => {
      void checkScopes().catch(() => {});
    }, 60_000);
    void (async () => {
      const sql = `SELECT n.post_id AS item_id,COALESCE(p.media_asset_id,r.media_asset_id,b.media_asset_id,'00000000-0000-0000-0000-000000000000') AS asset_id FROM note_pending n LEFT JOIN posts p ON p.id=n.post_id LEFT JOIN reels r ON r.id=n.post_id LEFT JOIN book_entries b ON b.id=n.post_id UNION SELECT json_extract(meta_data,'$.operation.itemId') AS item_id,id AS asset_id FROM attachments WHERE state=0 AND has_synced=0`;
      for await (const result of database.watch(sql, [], {
        signal: watchers.signal,
      })) {
        const rows = (result.rows?._array ?? []) as {
          item_id: string;
          asset_id: string;
        }[];
        for (const row of rows)
          if (row.item_id && !mediaPins.has(row.item_id)) {
            const pin = await database
              .syncStream("media_item", row)
              .subscribe({ ttl: 0 });
            if (watchers.signal.aborted) pin.unsubscribe();
            else mediaPins.set(row.item_id, pin);
          }
        for (const [id, pin] of mediaPins)
          if (!rows.some((row) => row.item_id === id)) {
            pin.unsubscribe();
            mediaPins.delete(id);
          }
      }
    })().catch(() => {});
    void (async () => {
      for await (const _ of database.watch(
        "SELECT * FROM revoked_homes UNION SELECT id,0 AS notified FROM homes UNION SELECT id,0 AS notified FROM attachments",
        [],
        { signal: watchers.signal },
      )) {
        await session.attachments.purgeRevoked();
      }
    })().catch(() => {});
    const pendingBoardsSql =
      "SELECT DISTINCT p.board_id FROM posts p JOIN note_pending n ON n.post_id = p.id";
    async function pinBoards(rows: { board_id: string }[]) {
      for (const { board_id: boardId } of rows) {
        if (!pins.has(boardId) && !watchers.signal.aborted) {
          const pin = await database
            .syncStream("board_notes", { board_id: boardId })
            .subscribe({ ttl: 604800 });
          if (watchers.signal.aborted) pin.unsubscribe();
          else pins.set(boardId, pin);
        }
      }
      for (const [boardId, pin] of pins) {
        if (!rows.some((row) => row.board_id === boardId)) {
          pin.unsubscribe();
          pins.delete(boardId);
        }
      }
    }
    await pinBoards(
      await database.getAll<{ board_id: string }>(pendingBoardsSql),
    );
    void (async () => {
      try {
        for await (const result of database.watch(pendingBoardsSql, [], {
          signal: watchers.signal,
        })) {
          await pinBoards(
            (result.rows?._array ?? []) as { board_id: string }[],
          );
        }
      } catch (error) {
        if (!watchers.signal.aborted)
          console.error("Pending-board subscription failed:", error);
      }
    })();
    const connector = createNoteConnector({
      isActive,
      fetchCredentials: async () => {
        const { endpoint } = await client.sync.configuration.query();
        const profile = await client.me.get.query();
        await database.execute(
          "INSERT OR REPLACE INTO account_profile (id,email,display_name) VALUES (?,?,?)",
          [profile.user.id, profile.user.email, profile.user.displayName],
        );
        await checkScopes();
        if (
          configuration.powersyncUrl &&
          new URL(endpoint).origin !==
            new URL(configuration.powersyncUrl).origin
        ) {
          throw new Error(
            "The backend and native app use different PowerSync instances. Check the development configuration.",
          );
        }
        const token = await user.getIdToken();
        return { endpoint, token };
      },
      applyNote: (operation) => client.sync.applyNote.mutate(operation),
      applyMedia: (operation) => client.sync.applyMedia.mutate(operation),
    });
    // connect() starts the SDK retry loop. Network availability must never
    // gate opening already-saved local data.
    connect = () => {
      void database.connect(connector).catch(() => {});
    };
    connect();
    await session.attachments.queue.startSync();
    return session;
  } catch (error) {
    await session.close();
    throw error;
  }
}

export async function browserSignIn(
  apiUrl: string,
  openBrowser: (url: string) => Promise<void>,
  onCode: (code: string) => void,
  signal: AbortSignal,
  returnTo?: "android",
): Promise<string> {
  const verifier = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const client = nativeApi(apiUrl);
  const { id, code } = await client.nativeAuth.begin.mutate({ challenge });
  onCode(code);
  await openBrowser(
    `${apiUrl}/native-auth?id=${encodeURIComponent(id)}${returnTo === "android" ? "&returnTo=android" : ""}`,
  );
  const expiresAt = Date.now() + 300_000;
  while (!signal.aborted && Date.now() < expiresAt) {
    const result = await client.nativeAuth.exchange.mutate(
      { id, verifier },
      { signal },
    );
    if (result.status === "approved") return result.token;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, 2000);
      signal.addEventListener("abort", done, { once: true });
    });
  }
  throw new Error(
    signal.aborted ? "Sign-in cancelled." : "Sign-in expired. Try again.",
  );
}
