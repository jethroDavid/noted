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
import { noteHistorySchema } from "@noted/validators/sync";
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
import { readNoteHistory } from "../services/sync";
import { protectedProcedure, router } from "../trpc";

const boardInput = z.object({ homeId: homeIdSchema, boardId: boardIdSchema });
const postInput = z.object({ homeId: homeIdSchema, postId: postIdSchema });

export const boardsRouter = router({
  history: protectedProcedure
    .input(
      postInput.extend({
        month: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
          .optional(),
        beforeRevision: z.number().int().positive().optional(),
      }),
    )
    .output(noteHistorySchema)
    .query(({ ctx, input }) =>
      readNoteHistory(ctx.user, input.homeId, input.postId, input),
    ),
  get: protectedProcedure
    .input(boardInput)
    .output(boardPostsResponseSchema)
    .query(async ({ ctx, input }) =>
      readBoard(ctx.user, input.homeId, input.boardId),
    ),

  createText: protectedProcedure
    .input(
      boardInput.extend(createTextPostSchema.shape).extend({
        operationId: z.uuid().optional(),
        postId: z.uuid().optional(),
      }),
    )
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      createTextPost(
        ctx.user,
        input.homeId,
        input.boardId,
        {
          text: input.text,
          foregroundColor: input.foregroundColor,
          backgroundColor: input.backgroundColor,
          x: input.x,
          y: input.y,
        },
        input,
      ),
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
    .input(
      postInput
        .extend(updatePostContentSchema.shape)
        .extend({ operationId: z.uuid().optional() }),
    )
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      editPostContent(
        ctx.user,
        input.homeId,
        input.postId,
        {
          text: input.text,
          foregroundColor: input.foregroundColor,
          backgroundColor: input.backgroundColor,
        },
        input.operationId,
      ),
    ),

  move: protectedProcedure
    .input(
      postInput
        .extend(updatePostPositionSchema.shape)
        .extend({ operationId: z.uuid().optional() }),
    )
    .output(boardPostSchema)
    .mutation(async ({ ctx, input }) =>
      movePost(
        ctx.user,
        input.homeId,
        input.postId,
        {
          x: input.x,
          y: input.y,
        },
        input.operationId,
      ),
    ),

  removePost: protectedProcedure
    .input(
      postInput.extend({
        expectedRevision: z.number().int().positive().optional(),
        operationId: z.uuid().optional(),
      }),
    )
    .output(z.object({ postId: postIdSchema }))
    .mutation(async ({ ctx, input }) =>
      removePost(
        ctx.user,
        input.homeId,
        input.postId,
        input.expectedRevision,
        input.operationId,
      ),
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
