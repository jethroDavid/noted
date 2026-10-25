import "server-only";
import {
  mediaOperationSchema,
  mediaTicketSchema,
  noteOperationSchema,
  noteOutcomeSchema,
} from "@noted/validators/sync";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  applyMediaOperation,
  nativeConfirmUpload,
  nativeMediaUrl,
  nativeUploadTicket,
  scopeStatus,
} from "../services/media-sync";
import { applyNoteOperation } from "../services/sync";
import { protectedProcedure, router } from "../trpc";

export const syncRouter = router({
  scopeStatus: protectedProcedure
    .input(z.object({ homeIds: z.array(z.uuid()).max(100) }))
    .query(({ ctx, input }) => scopeStatus(ctx.user, input.homeIds)),
  applyMedia: protectedProcedure
    .input(mediaOperationSchema)
    .output(noteOutcomeSchema)
    .mutation(({ ctx, input }) => applyMediaOperation(ctx.user, input)),
  uploadTicket: protectedProcedure
    .input(z.object({ homeId: z.uuid(), assetId: z.uuid() }))
    .output(mediaTicketSchema)
    .mutation(({ ctx, input }) =>
      nativeUploadTicket(ctx.user, input.homeId, input.assetId),
    ),
  confirmMedia: protectedProcedure
    .input(z.object({ homeId: z.uuid(), assetId: z.uuid() }))
    .output(
      z.object({
        code: z.enum(["VERIFIED", "ACCESS_REVOKED", "ITEM_DELETED"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      nativeConfirmUpload(ctx.user, input.homeId, input.assetId),
    ),
  mediaUrl: protectedProcedure
    .input(
      z.object({
        homeId: z.uuid(),
        assetId: z.uuid(),
        variant: z.enum(["original", "thumbnail", "poster"]),
      }),
    )
    .query(({ ctx, input }) =>
      nativeMediaUrl(ctx.user, input.homeId, input.assetId, input.variant),
    ),
  applyNote: protectedProcedure
    .input(noteOperationSchema)
    .output(noteOutcomeSchema)
    .mutation(({ ctx, input }) => applyNoteOperation(ctx.user, input)),
  configuration: protectedProcedure
    .output(z.object({ endpoint: z.url() }))
    .query(() => {
      const endpoint = process.env.POWERSYNC_URL;
      if (!endpoint)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Synchronization is not configured.",
        });
      const source = process.env.DATABASE_URL;
      if (
        source &&
        new URL(endpoint).hostname.endsWith(".powersync.journeyapps.com") &&
        ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
          new URL(source).hostname,
        )
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud PowerSync cannot read this backend's local PostgreSQL. Configure DATABASE_URL for the same source database before syncing.",
        });
      }
      return { endpoint };
    }),
});
