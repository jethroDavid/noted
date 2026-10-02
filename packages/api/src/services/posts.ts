import "server-only";
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
import { publishJob } from "@noted/queue/src";
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
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { boardChanged, mediaChanged } from "./events";
import type { CurrentUser } from "./identity";
import { deleteAssetIfOrphaned, requirePendingUpload } from "./media";

const postColumns = {
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
    .where(eq(posts.boardId, board.id))
    .orderBy(asc(posts.createdAt), asc(posts.id));
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
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  const created = await db.transaction(async (transaction) => {
    const [post] = await transaction
      .insert(posts)
      .values({
        boardId: board.id,
        creatorUserId: user.id,
        kind: "text",
        textContent: input.text,
        mediaAssetId: null,
        foregroundColor: input.foregroundColor,
        backgroundColor: input.backgroundColor,
        positionX: input.x,
        positionY: input.y,
      })
      .returning(postColumns);
    if (!post) throw new Error("Post insert returned no row.");
    await bumpPostAdditions(transaction, board.id);
    return toBoardPost({
      ...post,
      state: null,
      storageKey: null,
      thumbnailKey: null,
    });
  });
  await boardChanged(board.id);
  return created;
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
  const asset = await requirePendingUpload(
    board.homeId,
    input.assetId,
    "photo",
  );
  const row = await db.transaction(async (transaction) => {
    const [post] = await transaction
      .insert(posts)
      .values({
        boardId: board.id,
        creatorUserId: user.id,
        kind: "photo",
        textContent: null,
        mediaAssetId: asset.id,
        positionX: input.x,
        positionY: input.y,
      })
      .returning(postColumns);
    if (!post) throw new Error("Post insert returned no row.");
    await bumpPostAdditions(transaction, board.id);
    return post;
  });
  const created = await toBoardPost({
    ...row,
    state: asset.state,
    storageKey: asset.storageKey,
    thumbnailKey: asset.thumbnailKey,
  });
  await boardChanged(board.id);
  return created;
}

export async function editPostContent(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostContentInput,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  if (post.kind !== "text") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only text notes can be edited.",
    });
  }
  const [row] = await db
    .update(posts)
    .set({
      textContent: input.text,
      foregroundColor: input.foregroundColor,
      backgroundColor: input.backgroundColor,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.boardId, post.boardId)))
    .returning(postColumns);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  const edited = await toBoardPost({
    ...row,
    state: null,
    storageKey: null,
    thumbnailKey: null,
  });
  await boardChanged(edited.boardId);
  return edited;
}

export async function movePost(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostPositionInput,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const [row] = await db
    .update(posts)
    .set({ positionX: input.x, positionY: input.y, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.boardId, post.boardId)))
    .returning(postColumns);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  const moved = await toBoardPost({
    ...row,
    state: post.state,
    storageKey: post.storageKey,
    thumbnailKey: post.thumbnailKey,
  });
  await boardChanged(moved.boardId);
  return moved;
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
): Promise<{ postId: string }> {
  const post = await requirePost(user, homeId, postId);
  switch (post.kind) {
    case "text": {
      await db
        .delete(posts)
        .where(and(eq(posts.id, postId), eq(posts.boardId, post.boardId)));
      await boardChanged(post.boardId);
      return { postId };
    }
    case "photo": {
      if (!post.mediaAssetId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong. Please try again.",
        });
      }
      const mediaAssetId = post.mediaAssetId;
      // Readiness is re-read inside the transaction so a thumbnail landing
      // mid-remove still archives instead of discarding the photo.
      const outcome = await db.transaction(async (transaction) => {
        await transaction
          .delete(posts)
          .where(and(eq(posts.id, postId), eq(posts.boardId, post.boardId)));
        const [asset] = await transaction
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.id, mediaAssetId))
          .limit(1);
        const status = asset
          ? mediaDisplayStatus({
              state: asset.state,
              storageKey: asset.storageKey,
              variantKey: asset.thumbnailKey,
            })
          : "uploading";
        if (status === "ready") {
          await transaction.insert(bookEntries).values({
            homeId,
            mediaAssetId,
            archivedFromPostId: postId,
            archivedByUserId: user.id,
          });
          return { archived: true as const, keys: [] as string[] };
        }
        const keys = await deleteAssetIfOrphaned(transaction, mediaAssetId);
        return { archived: false as const, keys };
      });
      await boardChanged(post.boardId);
      if (outcome.archived) {
        // Archiving changes the book too: Book subscribers refetch.
        await mediaChanged(homeId);
      } else if (outcome.keys.length > 0) {
        await publishJob({
          job: "cleanup-media",
          homeId,
          assetId: mediaAssetId,
          keys: outcome.keys,
        });
      }
      return { postId };
    }
  }
  return assertNever(post.kind);
}

async function restorePost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: RestorePostInput,
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  return db.transaction(async (transaction) => {
    // Restoring the exact snapshot keeps the note's identity, position, and
    // place in creation order; repeated Undos converge on the same row.
    const inserted = await transaction
      .insert(posts)
      .values({
        id: input.postId,
        boardId: board.id,
        creatorUserId: user.id,
        kind: "text",
        textContent: input.text,
        mediaAssetId: null,
        foregroundColor: input.foregroundColor,
        backgroundColor: input.backgroundColor,
        positionX: input.x,
        positionY: input.y,
        createdAt: input.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: posts.id });
    const [post] = await transaction
      .select(postColumns)
      .from(posts)
      .where(and(eq(posts.id, input.postId), eq(posts.boardId, board.id)))
      .limit(1);
    if (!post) throw new Error("Restored post lookup returned no row.");
    if (inserted.length > 0) await bumpPostAdditions(transaction, board.id);
    return toBoardPost({
      ...post,
      state: null,
      storageKey: null,
      thumbnailKey: null,
    });
  });
}

async function restorePhotoPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: RestorePhotoPostInput,
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  return db.transaction(async (transaction) => {
    // Repeat Undos converge on the existing row instead of failing on the
    // already-consumed book entry, mirroring the text restore.
    const [existing] = await transaction
      .select(withMedia(postColumns))
      .from(posts)
      .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
      .where(and(eq(posts.id, input.postId), eq(posts.boardId, board.id)))
      .limit(1);
    if (existing) return await toBoardPost(existing);
    // The archive wrote the image reference into the book store; only the
    // entry for this post is consumed, so sibling posts sharing the same
    // asset are unaffected.
    const [entry] = await transaction
      .select({ mediaAssetId: bookEntries.mediaAssetId })
      .from(bookEntries)
      .where(
        and(
          eq(bookEntries.homeId, board.homeId),
          eq(bookEntries.archivedFromPostId, input.postId),
        ),
      )
      .limit(1);
    if (!entry) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Archived photo not found.",
      });
    }
    const inserted = await transaction
      .insert(posts)
      .values({
        id: input.postId,
        boardId: board.id,
        creatorUserId: user.id,
        kind: "photo",
        textContent: null,
        mediaAssetId: entry.mediaAssetId,
        positionX: input.x,
        positionY: input.y,
        createdAt: input.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: posts.id });
    await transaction
      .delete(bookEntries)
      .where(
        and(
          eq(bookEntries.homeId, board.homeId),
          eq(bookEntries.archivedFromPostId, input.postId),
        ),
      );
    const [post] = await transaction
      .select(withMedia(postColumns))
      .from(posts)
      .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
      .where(and(eq(posts.id, input.postId), eq(posts.boardId, board.id)))
      .limit(1);
    if (!post) throw new Error("Restored post lookup returned no row.");
    if (inserted.length > 0) await bumpPostAdditions(transaction, board.id);
    return await toBoardPost(post);
  });
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
