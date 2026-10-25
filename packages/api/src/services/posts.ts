import "server-only";
import { randomUUID } from "node:crypto";
import {
  boards,
  bookEntries,
  db,
  homeMemberships,
  homes,
  mediaAssets,
  posts,
} from "@noted/db/src";
import { mediaDisplayStatus } from "@noted/domain/src";
import { viewUrl } from "@noted/media/src";
import {
  isBoardViewerLive,
  leaveBoardPresence,
  listBoardViewers,
  publishBoardEvent,
  readBoardCache,
  refreshBoardPresence,
  subscribeToBoard,
  writeBoardCache,
} from "@noted/realtime/src";
import type {
  BoardEvent,
  BoardPost,
  BoardPostsResponse,
  BoardPresenceEvent,
  BoardViewer,
  CreateTextPostInput,
  CreateUploadedPhotoInput,
  RestoreAnyPostInput,
  RestorePhotoPostInput,
  RestorePostInput,
  UpdatePostContentInput,
  UpdatePostPositionInput,
} from "@noted/validators/src";
import {
  boardEventSchema,
  boardPostsResponseSchema,
  boardViewerSchema,
} from "@noted/validators/src";
import type { NoteOutcome } from "@noted/validators/sync";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { boardChanged, mediaChanged } from "./events";
import type { CurrentUser } from "./identity";
import { requirePendingUpload } from "./media";
import { applyMediaOperation } from "./media-sync";
import { applyNoteOperation } from "./sync";

const postColumns = {
  revision: posts.revision,
  id: posts.id,
  boardId: posts.boardId,
  kind: posts.kind,
  textContent: posts.textContent,
  mediaAssetId: posts.mediaAssetId,
  foregroundColor: posts.foregroundColor,
  backgroundColor: posts.backgroundColor,
  positionX: posts.positionX,
  positionY: posts.positionY,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
};

interface PostRow {
  revision: number;
  id: string;
  boardId: string;
  kind: "text" | "photo";
  textContent: string | null;
  mediaAssetId: string | null;
  foregroundColor: string;
  backgroundColor: string;
  positionX: number;
  positionY: number;
  createdAt: Date;
  updatedAt: Date;
  state: string | null;
  storageKey: string | null;
  thumbnailKey: string | null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A switch over every post kind ends with this, so a new kind fails the
// build until each switch handles it.
function assertNever(value: never): never {
  throw new Error(`Unhandled post kind: ${String(value)}`);
}

async function toBoardPost(row: PostRow): Promise<BoardPost> {
  if (row.kind === "photo") {
    if (!row.storageKey || !row.state) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      });
    }

    const status = mediaDisplayStatus({
      state: row.state,
      storageKey: row.storageKey,
      variantKey: row.thumbnailKey,
    });
    // Bundled keys serve from /public; uploads via fresh presigned GETs
    // (the caller checked membership first). Non-ready uploads carry nulls
    // and render a spinner until the worker's thumbnail lands.
    if (status !== "ready") {
      return {
        revision: row.revision,
        id: row.id,
        boardId: row.boardId,
        kind: "photo",
        status,
        imageUrl: null,
        thumbnailUrl: null,
        x: row.positionX,
        y: row.positionY,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    const imageUrl = await viewUrl(row.storageKey);
    return {
      id: row.id,
      boardId: row.boardId,
      kind: "photo",
      status,
      imageUrl,
      thumbnailUrl: row.thumbnailKey
        ? await viewUrl(row.thumbnailKey)
        : imageUrl,
      x: row.positionX,
      y: row.positionY,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
  if (row.textContent === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    });
  }
  return {
    revision: row.revision,
    id: row.id,
    boardId: row.boardId,
    kind: "text",
    text: row.textContent,
    foregroundColor: row.foregroundColor,
    backgroundColor: row.backgroundColor,
    x: row.positionX,
    y: row.positionY,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function withMedia<T extends Record<string, unknown>>(columns: T) {
  return {
    ...columns,
    state: mediaAssets.state,
    storageKey: mediaAssets.storageKey,
    thumbnailKey: mediaAssets.thumbnailKey,
  };
}

async function findBoardForMember(
  userId: string,
  homeId: string,
  boardId: string,
) {
  const [row] = await db
    .select({
      id: boards.id,
      homeId: boards.homeId,
      postAdditions: boards.postAdditions,
    })
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .where(
      and(
        eq(homeMemberships.userId, userId),
        eq(homes.id, homeId),
        eq(boards.id, boardId),
      ),
    )
    .limit(1);
  return row;
}

async function requireBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
) {
  const board = await findBoardForMember(user.id, homeId, boardId);
  if (!board) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Home not found." });
  }
  return board;
}

async function findPostForMember(
  userId: string,
  homeId: string,
  postId: string,
): Promise<PostRow | undefined> {
  const [row] = await db
    .select(withMedia(postColumns))
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .innerJoin(posts, eq(posts.boardId, boards.id))
    .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
    .where(
      and(
        eq(homeMemberships.userId, userId),
        eq(homes.id, homeId),
        eq(posts.id, postId),
        isNull(posts.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

async function requirePost(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<PostRow> {
  const row = await findPostForMember(user.id, homeId, postId);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  return row;
}

export async function readBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
): Promise<BoardPostsResponse> {
  const board = await requireBoard(user, homeId, boardId);
  // Cache-aside: validated on the way out, since only validated reads are
  // ever written back. A Redis outage reads through to Postgres.
  const cached = await readBoardCache(board.id);
  if (cached) {
    const parsed = boardPostsResponseSchema.safeParse(cached);
    if (parsed.success) return parsed.data;
    console.error("Dropping board cache entry that fails validation.");
  }
  const rows = await db
    .select(withMedia(postColumns))
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
    .where(and(eq(posts.boardId, board.id), isNull(posts.deletedAt)))
    // Array order is stack order (later paints on top), so the board sorts
    // by last touch: moves and edits bump updatedAt, and the note just
    // touched lands on top for every viewer.
    .orderBy(asc(posts.updatedAt), asc(posts.id));
  const response: BoardPostsResponse = {
    board: {
      id: board.id,
      homeId: board.homeId,
      postAdditions: board.postAdditions,
    },
    posts: await Promise.all(rows.map(toBoardPost)),
    serverTime: new Date(),
  };
  await writeBoardCache(board.id, response);
  return response;
}

async function bumpPostAdditions(transaction: Transaction, boardId: string) {
  await transaction
    .update(boards)
    .set({ postAdditions: sql`${boards.postAdditions} + 1` })
    .where(eq(boards.id, boardId));
}

export async function createTextPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: CreateTextPostInput,
  identity: { operationId?: string; postId?: string } = {},
): Promise<BoardPost> {
  const postId = identity.postId ?? randomUUID();
  ensureAccepted(
    await applyNoteOperation(user, {
      kind: "create",
      homeId,
      boardId,
      postId,
      operationId: identity.operationId ?? randomUUID(),
      value: input,
    }),
  );
  return toBoardPost(await requirePost(user, homeId, postId));
}

// Instant attach: the post row is created against the still-pending asset
// and subscribers see a spinner; the browser PUTs bytes in the background
// and confirmUpload queues processing once they land.
export async function createUploadedPhoto(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: CreateUploadedPhotoInput,
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  const result = await db.transaction(async (tx) => {
    const asset = await requirePendingUpload(
      user,
      homeId,
      input.assetId,
      "photo",
      tx,
    );
    const [existing] = await tx
      .select(postColumns)
      .from(posts)
      .where(eq(posts.mediaAssetId, asset.id))
      .limit(1);
    if (existing) {
      if (existing.boardId !== boardId)
        throw new TRPCError({ code: "CONFLICT" });
      return { row: existing, asset };
    }
    if (asset.state !== "pending") throw new TRPCError({ code: "CONFLICT" });
    const [row] = await tx
      .insert(posts)
      .values({
        boardId,
        creatorUserId: user.id,
        kind: "photo",
        mediaAssetId: asset.id,
        positionX: input.x,
        positionY: input.y,
      })
      .returning(postColumns);
    if (!row) throw Error("Photo insert returned no row.");
    await bumpPostAdditions(tx, boardId);
    return { row, asset };
  });
  await boardChanged(board.id);
  return toBoardPost({
    ...result.row,
    state: result.asset.state,
    storageKey: result.asset.storageKey,
    thumbnailKey: result.asset.thumbnailKey,
  });
}

export async function editPostContent(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostContentInput,
  operationId: string = randomUUID(),
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  ensureAccepted(
    await applyNoteOperation(user, {
      kind: "edit",
      homeId,
      boardId: post.boardId,
      postId,
      operationId,
      patch: input,
    }),
  );
  return toBoardPost(await requirePost(user, homeId, postId));
}

export async function movePost(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostPositionInput,
  operationId: string = randomUUID(),
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const context = {
    homeId,
    boardId: post.boardId,
    operationId,
    ...input,
  };
  ensureAccepted(
    post.kind === "text"
      ? await applyNoteOperation(user, { ...context, kind: "move", postId })
      : await applyMediaOperation(user, {
          ...context,
          kind: "move-photo",
          itemId: postId,
        }),
  );
  return toBoardPost(await requirePost(user, homeId, postId));
}

// The single removal for every post kind: text notes are deleted, ready
// photos are archived to the book store, and never-ready photos (a failed
// or abandoned upload) are deleted with their orphaned asset. The kind
// comes from the stored row, so callers never branch on it; a new kind
// adds one case below.
export async function removePost(
  user: CurrentUser,
  homeId: string,
  postId: string,
  expectedRevision?: number,
  operationId: string = randomUUID(),
): Promise<{ postId: string }> {
  const post = await requirePost(user, homeId, postId);
  const context = {
    homeId,
    operationId,
    expectedRevision: expectedRevision ?? post.revision,
  };
  ensureAccepted(
    post.kind === "text"
      ? await applyNoteOperation(user, {
          ...context,
          kind: "delete",
          boardId: post.boardId,
          postId,
        })
      : await applyMediaOperation(user, {
          ...context,
          kind: "archive-photo",
          itemId: postId,
        }),
  );
  return { postId };
}

async function restorePost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: RestorePostInput,
): Promise<BoardPost> {
  return createTextPost(user, homeId, boardId, input);
}

async function restorePhotoPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: RestorePhotoPostInput,
): Promise<BoardPost> {
  await requireBoard(user, homeId, boardId);
  const [entry] = await db
    .select()
    .from(bookEntries)
    .where(
      and(
        eq(bookEntries.homeId, homeId),
        eq(bookEntries.archivedFromPostId, input.postId),
        isNull(bookEntries.deletedAt),
      ),
    )
    .limit(1);
  if (!entry)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Archived photo not found.",
    });
  const postId = randomUUID();
  ensureAccepted(
    await applyMediaOperation(user, {
      kind: "restore-photo",
      operationId: randomUUID(),
      homeId,
      boardId,
      itemId: postId,
      archivedItemId: entry.id,
      expectedRevision: entry.revision,
      x: input.x,
      y: input.y,
    }),
  );
  return toBoardPost(await requirePost(user, homeId, postId));
}

// The single Undo for every post kind. The client's snapshot carries the
// discriminator, so the router stays thin; a new kind adds one case here
// plus its per-kind handler above.
export async function restoreAnyPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: RestoreAnyPostInput,
): Promise<BoardPost> {
  switch (input.kind) {
    case "text": {
      const restored = await restorePost(user, homeId, boardId, input);
      await boardChanged(restored.boardId);
      return restored;
    }
    case "photo": {
      const restored = await restorePhotoPost(user, homeId, boardId, input);
      await boardChanged(restored.boardId);
      // Undo consumes the book entry: Book subscribers refetch.
      await mediaChanged(homeId);
      return restored;
    }
  }
  return assertNever(input);
}

async function publishPresence(boardId: string): Promise<void> {
  const viewers = await currentViewers(boardId);
  await publishBoardEvent(boardId, {
    type: "presence",
    boardId,
    viewers,
  } satisfies BoardEvent);
}

// Viewer payloads cross Redis as untyped JSON, so they re-enter through
// zod here (and only here) before any subscriber sees them.
async function currentViewers(boardId: string): Promise<BoardViewer[]> {
  const viewers = await listBoardViewers(boardId);
  const parsed = boardViewerSchema.array().safeParse(viewers);

  if (!parsed.success) {
    console.error("Dropping presence viewers that fail validation.");
    return [];
  }

  return parsed.data;
}

// The board's event stream: joins presence, yields the current viewers,
// then yields validated room events. Membership is rechecked before each
// event so a revoked member's stream ends at the next event instead of
// leaking further updates. Joins, leaves, and refreshes tell the room only
// when the viewer set actually changes.
export async function* watchBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
): AsyncGenerator<BoardEvent> {
  const board = await requireBoard(user, homeId, boardId);
  const viewer = {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
  };

  const alreadyLive = await isBoardViewerLive(board.id, user.id);
  await refreshBoardPresence(board.id, viewer);

  if (!alreadyLive) await publishPresence(board.id);

  const queue: BoardEvent[] = [];
  let wake: (() => void) | null = null;

  const unsubscribe = await subscribeToBoard(board.id, (event) => {
    const parsed = boardEventSchema.safeParse(event);

    if (!parsed.success) {
      console.error("Dropping board event that fails validation.");
      return;
    }

    queue.push(parsed.data);
    wake?.();
  });

  try {
    yield {
      type: "presence",
      boardId: board.id,
      viewers: await currentViewers(board.id),
    } satisfies BoardEvent;
    for (;;) {
      while (queue.length > 0) {
        const event = queue.shift();

        if (!event) break;

        const membership = await findBoardForMember(user.id, homeId, boardId);
        // Throwing (not silently ending) tells the client to refetch, and
        // the refetch 404s into the "Home not found" screen: access ends
        // immediately and visibly, matching the HTTP behavior.
        if (!membership) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Home not found.",
          });
        }
        yield event;
      }
      // The executor runs synchronously, so a push can only land before
      // (queue non-empty, the loop continues) or after (wake is set).
      await new Promise<void>((resolve) => {
        wake = resolve;
      });

      wake = null;
    }
  } finally {
    wake = null;

    await unsubscribe();

    const wasLive = await isBoardViewerLive(board.id, user.id);

    await leaveBoardPresence(board.id, user.id);

    if (wasLive) await publishPresence(board.id);
  }
}

// Refreshes the caller's presence and returns the viewer list. Broadcasts
// only when the caller is new: steady-state refreshes stay quiet, and
// stragglers converge on their own next refresh.
export async function refreshPresence(
  user: CurrentUser,
  homeId: string,
  boardId: string,
): Promise<BoardPresenceEvent> {
  const board = await requireBoard(user, homeId, boardId);

  const viewer = {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
  };

  const alreadyLive = await isBoardViewerLive(board.id, user.id);
  await refreshBoardPresence(board.id, viewer);
  const viewers = await currentViewers(board.id);

  const event = {
    type: "presence",
    boardId: board.id,
    viewers,
  } satisfies BoardPresenceEvent;

  if (!alreadyLive) await publishBoardEvent(board.id, event);

  return event;
}

function ensureAccepted(outcome: NoteOutcome) {
  if (outcome.code === "ACCEPTED") return;
  throw new TRPCError({
    code:
      outcome.code === "ACCESS_REVOKED"
        ? "FORBIDDEN"
        : outcome.code === "DELETE_REQUIRES_CONFIRMATION"
          ? "CONFLICT"
          : outcome.code === "ITEM_DELETED"
            ? "NOT_FOUND"
            : "BAD_REQUEST",
    message:
      outcome.code === "DELETE_REQUIRES_CONFIRMATION"
        ? "This item changed. Close and reopen it before removing it again."
        : outcome.code === "INVALID_OPERATION"
          ? outcome.message
          : "This change can no longer be applied.",
  });
}
