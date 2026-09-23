import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { REMOVAL_RECOVERY_MS } from "@noted/domain";
import {
  boards,
  database,
  homeMemberships,
  homes,
  posts,
} from "@noted/database";

const REMOVAL_RECOVERY_SECONDS = REMOVAL_RECOVERY_MS / 1000;

const postColumns = {
  id: posts.id,
  boardId: posts.boardId,
  kind: posts.kind,
  textContent: posts.textContent,
  foregroundColor: posts.foregroundColor,
  backgroundColor: posts.backgroundColor,
  positionX: posts.positionX,
  positionY: posts.positionY,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  deletionRequestedAt: posts.deletionRequestedAt,
  deleteAfter: posts.deleteAfter,
};

/** Visible means never removed, or still inside the one-hour Undo window. Database time decides. */
function visiblePosts() {
  return or(isNull(posts.deleteAfter), gt(posts.deleteAfter, sql`now()`));
}

/** Editable means no removal was ever requested. Pending posts reject edits and moves. */
function editablePosts() {
  return isNull(posts.deletionRequestedAt);
}

export async function findBoardForMember(
  userId: string,
  homeId: string,
  boardId: string,
) {
  const [row] = await database
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

export async function findBoardPosts(boardId: string) {
  return database
    .select(postColumns)
    .from(posts)
    .where(and(eq(posts.boardId, boardId), visiblePosts()))
    .orderBy(asc(posts.createdAt), asc(posts.id));
}

export async function findPostForMember(
  userId: string,
  homeId: string,
  postId: string,
) {
  const [row] = await database
    .select(postColumns)
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .innerJoin(posts, eq(posts.boardId, boards.id))
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

export async function findPostInBoard(postId: string, boardId: string) {
  const [row] = await database
    .select(postColumns)
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.boardId, boardId)))
    .limit(1);
  return row;
}

export async function insertTextPost(input: {
  boardId: string;
  creatorUserId: string;
  text: string;
  foregroundColor: string;
  backgroundColor: string;
  x: number;
  y: number;
}) {
  return database.transaction(async (transaction) => {
    const [post] = await transaction
      .insert(posts)
      .values({
        boardId: input.boardId,
        creatorUserId: input.creatorUserId,
        kind: "text",
        textContent: input.text,
        mediaAssetId: null,
        foregroundColor: input.foregroundColor,
        backgroundColor: input.backgroundColor,
        positionX: input.x,
        positionY: input.y,
      })
      .returning(postColumns);
    await transaction
      .update(boards)
      .set({ postAdditions: sql`${boards.postAdditions} + 1` })
      .where(eq(boards.id, input.boardId));
    return post;
  });
}

export async function updateEditablePostContent(
  postId: string,
  boardId: string,
  patch: { text: string; foregroundColor: string; backgroundColor: string },
) {
  const [row] = await database
    .update(posts)
    .set({
      textContent: patch.text,
      foregroundColor: patch.foregroundColor,
      backgroundColor: patch.backgroundColor,
      updatedAt: new Date(),
    })
    .where(
      and(eq(posts.id, postId), eq(posts.boardId, boardId), editablePosts()),
    )
    .returning(postColumns);
  return row;
}

export async function updateEditablePostPosition(
  postId: string,
  boardId: string,
  patch: { x: number; y: number },
) {
  const [row] = await database
    .update(posts)
    .set({ positionX: patch.x, positionY: patch.y, updatedAt: new Date() })
    .where(
      and(eq(posts.id, postId), eq(posts.boardId, boardId), editablePosts()),
    )
    .returning(postColumns);
  return row;
}

export async function requestPostRemoval(postId: string, boardId: string) {
  const [row] = await database
    .update(posts)
    .set({
      deletionRequestedAt: sql`now()`,
      deleteAfter: sql`now() + make_interval(secs => ${REMOVAL_RECOVERY_SECONDS})`,
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, boardId),
        isNull(posts.deletionRequestedAt),
        visiblePosts(),
      ),
    )
    .returning(postColumns);
  return row;
}

export async function undoPostRemoval(postId: string, boardId: string) {
  const [row] = await database
    .update(posts)
    .set({ deletionRequestedAt: null, deleteAfter: null })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.boardId, boardId),
        gt(posts.deleteAfter, sql`now()`),
      ),
    )
    .returning(postColumns);
  return row;
}
