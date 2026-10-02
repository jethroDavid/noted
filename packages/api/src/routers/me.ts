import "server-only";
import { meResponseSchema } from "@noted/validators/src";
import { listHomes } from "../services/homes";
import { protectedProcedure, router } from "../trpc";

export const meRouter = router({
  get: protectedProcedure.output(meResponseSchema).query(async ({ ctx }) => ({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      displayName: ctx.user.displayName,
    },
    homes: await listHomes(ctx.user),
  })),
});
