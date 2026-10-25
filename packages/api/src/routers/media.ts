import "server-only";
import {
  assetIdSchema,
  bookEntryIdSchema,
  bookResponseSchema,
  confirmUploadSchema,
  createReelSchema,
  homeIdSchema,
  reelIdSchema,
  reelSchema,
  reelsResponseSchema,
  requestUploadSchema,
  uploadTicketSchema,
} from "@noted/validators/src";
import { z } from "zod";
import {
  cancelUpload,
  confirmUpload,
  createReel,
  deleteBookEntry,
  deleteReel,
  listBook,
  listReels,
  requestUpload,
  watchHome,
} from "../services/media";
import { protectedProcedure, router } from "../trpc";

const homeInput = z.object({ homeId: homeIdSchema });

export const mediaRouter = router({
  cancelUpload: protectedProcedure
    .input(homeInput.extend({ assetId: assetIdSchema }))
    .mutation(({ ctx, input }) =>
      cancelUpload(ctx.user, input.homeId, input.assetId),
    ),
  // The schema is used whole (never .shape-extended): its superRefine
  // checks would not survive the split.
  requestUpload: protectedProcedure
    .input(requestUploadSchema)
    .output(uploadTicketSchema)
    .mutation(async ({ ctx, input }) =>
      requestUpload(ctx.user, input.homeId, {
        kind: input.kind,
        contentType: input.contentType,
        byteSize: input.byteSize,
        checksum: input.checksum,
      }),
    ),

  createReel: protectedProcedure
    .input(homeInput.extend(createReelSchema.shape))
    .output(reelSchema)
    .mutation(async ({ ctx, input }) =>
      createReel(ctx.user, input.homeId, { assetId: input.assetId }),
    ),

  confirmUpload: protectedProcedure
    .input(homeInput.extend(confirmUploadSchema.shape))
    .output(z.object({ assetId: assetIdSchema }))
    .mutation(async ({ ctx, input }) =>
      confirmUpload(ctx.user, input.homeId, input.assetId),
    ),

  listReels: protectedProcedure
    .input(homeInput)
    .output(reelsResponseSchema)
    .query(async ({ ctx, input }) => listReels(ctx.user, input.homeId)),

  listBook: protectedProcedure
    .input(homeInput)
    .output(bookResponseSchema)
    .query(async ({ ctx, input }) => listBook(ctx.user, input.homeId)),

  deleteReel: protectedProcedure
    .input(
      homeInput.extend({
        reelId: reelIdSchema,
        expectedRevision: z.number().int().positive().optional(),
        operationId: z.uuid().optional(),
      }),
    )
    .output(z.object({ reelId: reelIdSchema }))
    .mutation(async ({ ctx, input }) =>
      deleteReel(ctx.user, input.homeId, {
        reelId: input.reelId,
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
      }),
    ),

  deleteBookEntry: protectedProcedure
    .input(
      homeInput.extend({
        entryId: bookEntryIdSchema,
        expectedRevision: z.number().int().positive().optional(),
        operationId: z.uuid().optional(),
      }),
    )
    .output(z.object({ entryId: bookEntryIdSchema }))
    .mutation(async ({ ctx, input }) =>
      deleteBookEntry(ctx.user, input.homeId, {
        entryId: input.entryId,
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
      }),
    ),

  // No .output(), mirroring boards.onEvent: watchHome validates every
  // yielded event instead, and the MediaEvent type still flows through.
  onHomeEvent: protectedProcedure
    .input(homeInput)
    .subscription(async function* ({ ctx, input }) {
      yield* watchHome(ctx.user, input.homeId);
    }),
});
