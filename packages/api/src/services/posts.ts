import {
  boards,
  bookEntries,
  db,
  homeMemberships,
  homes,
  mediaAssets,
  posts,
} from "@noted/db/src";
import {
  PHOTO_FIXTURES,
  photoFixtureStorageKey,
  REMOVAL_RECOVERY_MS,
} from "@noted/domain/src";
import type {
  BoardPost,
  BoardPostsResponse,
  CreatePhotoPostInput,
  CreateTextPostInput,
  UpdatePostContentInput,
  UpdatePostPositionInput,
} from "@noted/validators/src";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { CurrentUser } from "./identity";

const REMOVAL_RECOVERY_SECONDS = REMOVAL_RECOVERY_MS / 1000;

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
  deletionRequestedAt: posts.deletionRequestedAt,
  deleteAfter: posts.deleteAfter,
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
  deletionRequestedAt: Date | null;
  deleteAfter: Date | null;
  storageKey: string | null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toBoardPost(row: PostRow): BoardPost {
  if (row.kind === "photo") {
    if (!row.storageKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      });
    }
    return {
      id: row.id,
      boardId: row.boardId,
      kind: "photo",
      imageUrl: `/${row.storageKey}`,
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
    deletionRequestedAt: row.deletionRequestedAt,
    deleteAfter: row.deleteAfter,
  };
}

function isExpired(row: Pick<PostRow, "deleteAfter">, now: Date) {
  return row.deleteAfter !== null && row.deleteAfter.getTime() <= now.getTime();
}

/** Visible means never removed, or still inside the one-hour Undo window. Database time decides. */
function visiblePosts() {
  return or(isNull(posts.deleteAfter), gt(posts.deleteAfter, sql`now()`));
}

/** Editable means no removal was ever requested. Pending posts reject edits and moves. */
function editablePosts() {
  return isNull(posts.deletionRequestedAt);
}

function withMedia<T extends Record<string, unknown>>(columns: T) {
  return { ...columns, storageKey: mediaAssets.storageKey };
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

async function findPostInBoard(
  postId: string,
  boardId: string,
): Promise<PostRow | undefined> {
  const [row] = await db
    .select(withMedia(postColumns))
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
    .where(and(eq(posts.id, postId), eq(posts.boardId, boardId)))
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

async function missedUpdate(
  postId: string,
  boardId: string,
  action: "edit" | "move",
): Promise<never> {
  const row = await findPostInBoard(postId, boardId);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  if (isExpired(row, new Date())) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This post has already been removed.",
    });
  }
  const verb = action === "edit" ? "edit it" : "move it";
  throw new TRPCError({
    code: "CONFLICT",
    message: `This post is greyed out for removal. Undo removal to ${verb}.`,
  });
}

export async function readBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
): Promise<BoardPostsResponse> {
  const board = await requireBoard(user, homeId, boardId);
  const rows = await db
    .select(withMedia(postColumns))
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
    .where(and(eq(posts.boardId, board.id), visiblePosts()))
    .orderBy(asc(posts.createdAt), asc(posts.id));
  // App-server time anchors the client's display countdown. Removal
  // eligibility itself is decided by database time in SQL.
  return {
    board: {
      id: board.id,
      homeId: board.homeId,
      postAdditions: board.postAdditions,
    },
    posts: rows.map(toBoardPost),
    serverTime: new Date(),
  };
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
  return db.transaction(async (transaction) => {
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
    return toBoardPost({ ...post, storageKey: null });
  });
}

export async function createPhotoPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: CreatePhotoPostInput,
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  const fixture = PHOTO_FIXTURES.find(
    (candidate) => candidate.key === input.fixture,
  );
  if (!fixture) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unknown photo fixture.",
    });
  }
  const storageKey = photoFixtureStorageKey(fixture.key);
  return db.transaction(async (transaction) => {
    // Fixture assets are per-home lazy rows; concurrent first uses converge.
    await transaction
      .insert(mediaAssets)
      .values({
        homeId: board.homeId,
        kind: "photo",
        state: "attached",
        storageKey,
        contentType: fixture.contentType,
        byteSize: fixture.byteSize,
        width: null,
        height: null,
      })
      .onConflictDoNothing();
    const [asset] = await transaction
      .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.homeId, board.homeId),
          eq(mediaAssets.storageKey, storageKey),
        ),
      )
      .limit(1);
    if (!asset) throw new Error("Fixture asset lookup returned no row.");
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
    return toBoardPost({ ...post, storageKey: asset.storageKey });
  });
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
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, post.boardId),
        editablePosts(),
      ),
    )
    .returning(postColumns);
  if (!row) {
    await missedUpdate(postId, post.boardId, "edit");
  }
  return toBoardPost({ ...row, storageKey: null });
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
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, post.boardId),
        editablePosts(),
      ),
    )
    .returning(postColumns);
  if (!row) {
    await missedUpdate(postId, post.boardId, "move");
  }
  return toBoardPost({ ...row, storageKey: post.storageKey });
}

export async function requestRemoval(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  if (post.kind !== "text") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Photo notes archive instantly; only text notes use Undo.",
    });
  }
  const [row] = await db
    .update(posts)
    .set({
      deletionRequestedAt: sql`now()`,
      deleteAfter: sql`now() + make_interval(secs => ${REMOVAL_RECOVERY_SECONDS})`,
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, post.boardId),
        isNull(posts.deletionRequestedAt),
        visiblePosts(),
      ),
    )
    .returning(postColumns);
  if (row) return toBoardPost({ ...row, storageKey: null });
  const existing = await findPostInBoard(postId, post.boardId);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  // Repeated removal is idempotent: the pending post comes back unchanged.
  if (!isExpired(existing, new Date())) return toBoardPost(existing);
  throw new TRPCError({
    code: "CONFLICT",
    message: "This post has already been removed.",
  });
}

export async function undoRemoval(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const [row] = await db
    .update(posts)
    .set({ deletionRequestedAt: null, deleteAfter: null })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, post.boardId),
        gt(posts.deleteAfter, sql`now()`),
      ),
    )
    .returning(postColumns);
  if (row) return toBoardPost({ ...row, storageKey: post.storageKey });
  const existing = await findPostInBoard(postId, post.boardId);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }
  // Undoing a live post is a no-op success; only expiry is a conflict.
  if (!isExpired(existing, new Date())) return toBoardPost(existing);
  throw new TRPCError({
    code: "CONFLICT",
    message: "The one-hour Undo period has ended.",
  });
}

export async function archivePhoto(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<{ postId: string }> {
  const post = await requirePost(user, homeId, postId);
  if (post.kind !== "photo" || !post.mediaAssetId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only photo notes can be archived.",
    });
  }
  const mediaAssetId = post.mediaAssetId;
  await db.transaction(async (transaction) => {
    await transaction
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.boardId, post.boardId)));
    await transaction.insert(bookEntries).values({
      homeId,
      mediaAssetId,
      archivedFromPostId: postId,
      archivedByUserId: user.id,
    });
  });
  return { postId };
}
