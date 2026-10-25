"use client";

import type { AppRouter } from "@noted/api/src";
import {
  localBoard,
  localBook,
  localHome,
  localPost,
  localReels,
  saveMediaOperation,
  saveNoteOperation,
} from "@noted/offline/src";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
  TRPCClientError,
} from "@trpc/client";
import type { TRPCLink } from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";
import type { NativeSession } from "./session";

type Inputs = inferRouterInputs<AppRouter>;
type Outputs = inferRouterOutputs<AppRouter>;
export function createSceneClient(
  session: NativeSession,
  apiUrl: string,
  token: () => Promise<string>,
) {
  const db = session.database,
    url = session.attachments.localUrl;
  const board = (homeId: string, boardId: string) =>
    localBoard(db, homeId, boardId, url);
  const post = async (homeId: string, postId: string) => {
    const row = await localPost(db, homeId, postId);
    const result = (await board(homeId, row.board_id)).posts.find(
      (p) => p.id === postId,
    );
    if (!result) throw Error("Item is no longer available.");
    return result;
  };
  const local = {
    homes: {
      get: (input: Inputs["homes"]["get"]): Promise<Outputs["homes"]["get"]> =>
        localHome(db, input.homeId),
    },
    boards: {
      async history(i: Inputs["boards"]["history"]) {
        await localPost(db, i.homeId, i.postId);
        const month = i.month ?? new Date().toISOString().slice(0, 7);
        await session.pinHistory(i.postId, month);
        const rows = await db.getAll<{
          revision: number;
          text: string;
          foreground_color: string;
          background_color: string;
          created_at: string;
        }>(
          "SELECT * FROM note_revisions WHERE post_id=? AND substr(created_at,1,7)=? AND revision<? ORDER BY revision DESC LIMIT 101",
          [i.postId, month, i.beforeRevision ?? Number.MAX_SAFE_INTEGER],
        );
        return {
          hasMore: rows.length > 100,
          revisions: rows.slice(0, 100).map((row) => ({
            revision: row.revision,
            text: row.text,
            foregroundColor: row.foreground_color,
            backgroundColor: row.background_color,
            createdAt: new Date(row.created_at),
          })),
        };
      },
      get: (i: Inputs["boards"]["get"]) => board(i.homeId, i.boardId),
      async createText(i: Inputs["boards"]["createText"]) {
        const postId = i.postId ?? crypto.randomUUID();
        await saveNoteOperation(db, {
          kind: "create",
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          boardId: i.boardId,
          postId,
          value: i,
        });
        return post(i.homeId, postId);
      },
      async editContent(i: Inputs["boards"]["editContent"]) {
        const row = await localPost(db, i.homeId, i.postId);
        await saveNoteOperation(db, {
          kind: "edit",
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          boardId: row.board_id,
          postId: i.postId,
          patch: {
            text: i.text,
            foregroundColor: i.foregroundColor,
            backgroundColor: i.backgroundColor,
          },
        });
        return post(i.homeId, i.postId);
      },
      async move(i: Inputs["boards"]["move"]) {
        const row = await localPost(db, i.homeId, i.postId);
        const context = {
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          boardId: row.board_id,
          x: i.x,
          y: i.y,
        };
        if (row.kind === "text")
          await saveNoteOperation(db, {
            ...context,
            kind: "move",
            postId: i.postId,
          });
        else
          await saveMediaOperation(db, {
            ...context,
            kind: "move-photo",
            itemId: i.postId,
          });
        return post(i.homeId, i.postId);
      },
      async removePost(i: Inputs["boards"]["removePost"]) {
        const row = await localPost(db, i.homeId, i.postId);
        const base = {
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          expectedRevision: i.expectedRevision ?? Math.max(1, row.revision),
        };
        if (row.kind === "text")
          await saveNoteOperation(db, {
            ...base,
            kind: "delete",
            boardId: row.board_id,
            postId: i.postId,
          });
        else
          await saveMediaOperation(db, {
            ...base,
            kind: "archive-photo",
            itemId: i.postId,
          });
        return { postId: i.postId };
      },
      async restorePost(i: Inputs["boards"]["restorePost"]) {
        if (i.kind !== "text") {
          const entry = await db.get<{ id: string; revision: number }>(
            "SELECT id,revision FROM book_entries WHERE id=? AND home_id=? AND deleted_at IS NULL",
            [i.postId, i.homeId],
          );
          const postId = crypto.randomUUID();
          await saveMediaOperation(db, {
            kind: "restore-photo",
            operationId: crypto.randomUUID(),
            homeId: i.homeId,
            boardId: i.boardId,
            itemId: postId,
            archivedItemId: entry.id,
            expectedRevision: Math.max(1, entry.revision),
            x: i.x,
            y: i.y,
          });
          return post(i.homeId, postId);
        }
        return local.boards.createText({
          ...i,
          postId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
        });
      },
    },
    media: {
      listReels: (i: Inputs["media"]["listReels"]) =>
        localReels(db, i.homeId, url),
      listBook: (i: Inputs["media"]["listBook"]) =>
        localBook(db, i.homeId, url),
      async deleteReel(i: Inputs["media"]["deleteReel"]) {
        await localHome(db, i.homeId);
        const row = await db.get<{ revision: number }>(
          "SELECT revision FROM reels WHERE id=? AND home_id=?",
          [i.reelId, i.homeId],
        );
        await saveMediaOperation(db, {
          kind: "archive-video",
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          itemId: i.reelId,
          expectedRevision: i.expectedRevision ?? Math.max(1, row.revision),
        });
        return { reelId: i.reelId };
      },
      async deleteBookEntry(i: Inputs["media"]["deleteBookEntry"]) {
        await localHome(db, i.homeId);
        const row = await db.get<{ revision: number }>(
          "SELECT revision FROM book_entries WHERE id=? AND home_id=?",
          [i.entryId, i.homeId],
        );
        await saveMediaOperation(db, {
          kind: "delete-book",
          operationId: i.operationId ?? crypto.randomUUID(),
          homeId: i.homeId,
          itemId: i.entryId,
          expectedRevision: i.expectedRevision ?? Math.max(1, row.revision),
        });
        return { entryId: i.entryId };
      },
    },
  };
  const handlers: Record<string, (input: never) => Promise<unknown>> = {};
  for (const [router, procedures] of Object.entries(local))
    for (const [name, handler] of Object.entries(procedures))
      handlers[`${router}.${name}`] = handler as (
        input: never,
      ) => Promise<unknown>;
  const link: TRPCLink<AppRouter> =
    () =>
    ({ op, next }) => {
      const handler = handlers[op.path];
      if (!handler) return next(op);
      return observable((observer) => {
        if (!session.active) {
          observer.error(
            TRPCClientError.from(new Error("This account is paused.")),
          );
          return;
        }
        let canceled = false;
        void handler(op.input as never)
          .then((data) => {
            if (!canceled) {
              observer.next({ result: { data } });
              observer.complete();
            }
          })
          .catch((error) => {
            if (!canceled)
              observer.error(
                TRPCClientError.from(
                  error instanceof Error
                    ? error
                    : new Error("Local operation failed."),
                ),
              );
          });
        return () => {
          canceled = true;
        };
      });
    };
  return createTRPCClient<AppRouter>({
    links: [
      link,
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({
          url: `${apiUrl}/api/trpc`,
          transformer: superjson,
          connectionParams: async () => ({ token: await token() }),
        }),
        false: httpBatchLink({
          url: `${apiUrl}/api/trpc`,
          transformer: superjson,
          headers: async () => ({ authorization: `Bearer ${await token()}` }),
        }),
      }),
    ],
  });
}
