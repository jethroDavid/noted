import type {
  BoardPost,
  BoardPostsResponse,
  CreatePostInput,
  UpdatePostContentInput,
  UpdatePostPositionInput,
} from "@noted/contracts";

import {
  findBoardForMember,
  findBoardPosts,
  findPostForMember,
  findPostInBoard,
  insertTextPost,
  requestPostRemoval,
  undoPostRemoval,
  updateEditablePostContent,
  updateEditablePostPosition,
} from "./data/post-queries";
import { ServiceError } from "./errors";
import type { CurrentUser } from "./identity";

type PostRow = NonNullable<Awaited<ReturnType<typeof findPostInBoard>>>;

function toBoardPost(row: PostRow): BoardPost {
  if (row.kind !== "text" || row.textContent === null) {
    throw new ServiceError(500, "Something went wrong. Please try again.");
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletionRequestedAt: row.deletionRequestedAt?.toISOString() ?? null,
    deleteAfter: row.deleteAfter?.toISOString() ?? null,
  };
}

function isExpired(row: PostRow, now: Date) {
  return row.deleteAfter !== null && row.deleteAfter.getTime() <= now.getTime();
}

async function requireBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
) {
  const board = await findBoardForMember(user.id, homeId, boardId);
  if (!board) throw new ServiceError(404, "Home not found.");
  return board;
}

async function requirePost(user: CurrentUser, homeId: string, postId: string) {
  const row = await findPostForMember(user.id, homeId, postId);
  if (!row) throw new ServiceError(404, "Post not found.");
  return row;
}

async function missedUpdate(
  postId: string,
  boardId: string,
  action: "edit" | "move",
): Promise<never> {
  const row = await findPostInBoard(postId, boardId);
  if (!row) throw new ServiceError(404, "Post not found.");
  if (isExpired(row, new Date())) {
    throw new ServiceError(409, "This post has already been removed.");
  }
  const verb = action === "edit" ? "edit it" : "move it";
  throw new ServiceError(
    409,
    `This post is greyed out for removal. Undo removal to ${verb}.`,
  );
}

export async function readBoard(
  user: CurrentUser,
  homeId: string,
  boardId: string,
): Promise<BoardPostsResponse> {
  const board = await requireBoard(user, homeId, boardId);
  const rows = await findBoardPosts(board.id);
  // App-server time anchors the client's display countdown. Removal
  // eligibility itself is decided by database time in SQL.
  return {
    board: {
      id: board.id,
      homeId: board.homeId,
      postAdditions: board.postAdditions,
    },
    posts: rows.map(toBoardPost),
    serverTime: new Date().toISOString(),
  };
}

export async function createTextPost(
  user: CurrentUser,
  homeId: string,
  boardId: string,
  input: CreatePostInput,
): Promise<BoardPost> {
  const board = await requireBoard(user, homeId, boardId);
  const row = await insertTextPost({
    boardId: board.id,
    creatorUserId: user.id,
    text: input.text,
    foregroundColor: input.foregroundColor,
    backgroundColor: input.backgroundColor,
    x: input.x,
    y: input.y,
  });
  return toBoardPost(row);
}

export async function editPostContent(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostContentInput,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const row = await updateEditablePostContent(postId, post.boardId, {
    text: input.text,
    foregroundColor: input.foregroundColor,
    backgroundColor: input.backgroundColor,
  });
  if (!row) {
    await missedUpdate(postId, post.boardId, "edit");
  }
  return toBoardPost(row);
}

export async function movePost(
  user: CurrentUser,
  homeId: string,
  postId: string,
  input: UpdatePostPositionInput,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const row = await updateEditablePostPosition(postId, post.boardId, {
    x: input.x,
    y: input.y,
  });
  if (!row) {
    await missedUpdate(postId, post.boardId, "move");
  }
  return toBoardPost(row);
}

export async function requestRemoval(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const row = await requestPostRemoval(postId, post.boardId);
  if (row) return toBoardPost(row);
  const existing = await findPostInBoard(postId, post.boardId);
  if (!existing) throw new ServiceError(404, "Post not found.");
  // Repeated removal is idempotent: the pending post comes back unchanged.
  if (!isExpired(existing, new Date())) return toBoardPost(existing);
  throw new ServiceError(409, "This post has already been removed.");
}

export async function undoRemoval(
  user: CurrentUser,
  homeId: string,
  postId: string,
): Promise<BoardPost> {
  const post = await requirePost(user, homeId, postId);
  const row = await undoPostRemoval(postId, post.boardId);
  if (row) return toBoardPost(row);
  const existing = await findPostInBoard(postId, post.boardId);
  if (!existing) throw new ServiceError(404, "Post not found.");
  // Undoing a live post is a no-op success; only expiry is a conflict.
  if (!isExpired(existing, new Date())) return toBoardPost(existing);
  throw new ServiceError(409, "The one-hour Undo period has ended.");
}
