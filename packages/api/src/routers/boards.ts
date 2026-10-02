import "server-only";
import {
  boardIdSchema,
  boardPostSchema,
  boardPostsResponseSchema,
  boardPresenceEventSchema,
  createTextPostSchema,
  createUploadedPhotoSchema,
  homeIdSchema,
  postIdSchema,
  restoreAnyPostSchema,
  updatePostContentSchema,
  updatePostPositionSchema,
} from "@noted/validators/src";
import { z } from "zod";
import {
  createTextPost,
  createUploadedPhoto,
  editPostContent,
  movePost,
  readBoard,
  refreshPresence,
  removePost,
  restoreAnyPost,
  watchBoard,
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

  createUploadedPhoto: protectedProcedure
    .input(boardInput.extend(createUploadedPhotoSchema.shape))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      createUploadedPhoto(ctx.user, input.homeId, input.boardId, {
        assetId: input.assetId,
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

  removePost: protectedProcedure
    .input(postInput)
    .output(z.object({ postId: postIdSchema }))
    .mutation(async ({ ctx, input }) =>
      removePost(ctx.user, input.homeId, input.postId),
    ),

  restorePost: protectedProcedure
    .input(boardInput.and(restoreAnyPostSchema))
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      restoreAnyPost(ctx.user, input.homeId, input.boardId, input),
    ),

  // No .output(): tRPC types it as the resolver's return, which breaks
  // generator inference. watchBoard validates every yielded event instead,
  // and the BoardEvent type still flows to the client.
  onEvent: protectedProcedure.input(boardInput).subscription(async function* ({
    ctx,
    input,
  }) {
    yield* watchBoard(ctx.user, input.homeId, input.boardId);
  }),

  refreshPresence: protectedProcedure
    .input(boardInput)
    .output(boardPresenceEventSchema)
    .mutation(async ({ ctx, input }) =>
      refreshPresence(ctx.user, input.homeId, input.boardId),
    ),
});
