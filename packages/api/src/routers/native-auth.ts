import "server-only";
import { z } from "zod";
import {
  approveNativeSignIn,
  beginNativeSignIn,
  exchangeNativeSignIn,
  nativeSignInInfo,
} from "../services/native-auth";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const id = z.object({ id: z.uuid() });
export const nativeAuthRouter = router({
  begin: publicProcedure
    .input(z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }))
    .mutation(({ input }) => beginNativeSignIn(input.challenge)),
  info: publicProcedure
    .input(id)
    .query(({ input }) => nativeSignInInfo(input.id)),
  approve: protectedProcedure
    .input(id)
    .mutation(({ ctx, input }) => approveNativeSignIn(input.id, ctx.user.id)),
  exchange: publicProcedure
    .input(id.extend({ verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/) }))
    .mutation(({ input }) => exchangeNativeSignIn(input.id, input.verifier)),
});
