import "server-only";
import { noteOperationSchema, noteOutcomeSchema } from "@noted/validators/sync";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { applyNoteOperation } from "../services/sync";
import { protectedProcedure, router } from "../trpc";

export const syncRouter = router({
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
      return { endpoint };
    }),
});
