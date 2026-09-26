import {
  boardIdSchema,
  boardPostSchema,
  boardPostsResponseSchema,
  createPhotoPostSchema,
  createTextPostSchema,
  homeIdSchema,
  postIdSchema,
  updatePostContentSchema,
  updatePostPositionSchema,
} from "@noted/validators/src";
import { z } from "zod";
import {
  archivePhoto,
  createPhotoPost,
  createTextPost,
  editPostContent,
  movePost,
  readBoard,
  requestRemoval,
  undoRemoval,
} from "../services/posts";
import { protectedProcedure, router } from "../trpc";

const boardInput = z.object({ homeId: homeIdSchema, boardId: boardIdSchema });
const postInput = z.object({ homeId: homeIdSchema, postId: postIdSchema });

export const boardsRouter = router({
  get: protectedProcedure
    .input(boardInput)
    .output(boardPostsResponseSchema)
    .query(async ({ ctx, input }) =>
      readBoard(ctx.user, input.homeId, input.boardId),
    ),

  createText: protectedProcedure
    .input(boardInput.extend(createTextPostSchema.shape))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      createTextPost(ctx.user, input.homeId, input.boardId, {
        text: input.text,
        foregroundColor: input.foregroundColor,
        backgroundColor: input.backgroundColor,
        x: input.x,
        y: input.y,
      }),
    ),

  createPhoto: protectedProcedure
    .input(boardInput.extend(createPhotoPostSchema.shape))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      createPhotoPost(ctx.user, input.homeId, input.boardId, {
        fixture: input.fixture,
        x: input.x,
        y: input.y,
      }),
    ),

  editContent: protectedProcedure
    .input(postInput.extend(updatePostContentSchema.shape))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      editPostContent(ctx.user, input.homeId, input.postId, {
        text: input.text,
        foregroundColor: input.foregroundColor,
        backgroundColor: input.backgroundColor,
      }),
    ),

  move: protectedProcedure
    .input(postInput.extend(updatePostPositionSchema.shape))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      movePost(ctx.user, input.homeId, input.postId, {
        x: input.x,
        y: input.y,
      }),
    ),

  requestRemoval: protectedProcedure
    .input(postInput)
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      requestRemoval(ctx.user, input.homeId, input.postId),
    ),

  undoRemoval: protectedProcedure
    .input(postInput)
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      undoRemoval(ctx.user, input.homeId, input.postId),
    ),

  archivePhoto: protectedProcedure
    .input(postInput)
    .output(z.object({ postId: postIdSchema }))
    .mutation(async ({ ctx, input }) =>
      archivePhoto(ctx.user, input.homeId, input.postId),
    ),
});
