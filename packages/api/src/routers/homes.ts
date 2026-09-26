import {
  createHomeSchema,
  homeIdSchema,
  homeResponseSchema,
  homeSchema,
  homesResponseSchema,
  invitationSchema,
  inviteMemberSchema,
  renameHomeSchema,
} from "@noted/validators/src";
import { z } from "zod";
import {
  createHome,
  getHomeDetail,
  inviteMember,
  leaveHome,
  listHomes,
  removeMember,
  renameHome,
  revokeInvitation,
} from "../services/homes";
import { protectedProcedure, router } from "../trpc";

const homeIdInput = z.object({ homeId: homeIdSchema });

export const homesRouter = router({
  list: protectedProcedure
    .output(homesResponseSchema)
    .query(async ({ ctx }) => ({ homes: await listHomes(ctx.user) })),

  create: protectedProcedure
    .input(createHomeSchema)
    .output(homeSchema)
    .mutation(async ({ ctx, input }) => createHome(ctx.user, input)),

  get: protectedProcedure
    .input(homeIdInput)
    .output(homeResponseSchema)
    .query(async ({ ctx, input }) => ({
      home: await getHomeDetail(ctx.user, input.homeId),
    })),

  rename: protectedProcedure
    .input(homeIdInput.extend(renameHomeSchema.shape))
    .output(homeSchema)
    .mutation(async ({ ctx, input }) =>
      renameHome(ctx.user, input.homeId, { name: input.name }),
    ),

  invite: protectedProcedure
    .input(homeIdInput.extend(inviteMemberSchema.shape))
    .output(invitationSchema)
    .mutation(async ({ ctx, input }) =>
      inviteMember(ctx.user, input.homeId, { email: input.email }),
    ),

  revokeInvitation: protectedProcedure
    .input(homeIdInput.extend({ invitationId: z.uuid() }))
    .output(invitationSchema)
    .mutation(async ({ ctx, input }) =>
      revokeInvitation(ctx.user, input.homeId, {
        invitationId: input.invitationId,
      }),
    ),

  removeMember: protectedProcedure
    .input(homeIdInput.extend({ userId: z.uuid() }))
    .output(z.object({ userId: z.uuid() }))
    .mutation(async ({ ctx, input }) =>
      removeMember(ctx.user, input.homeId, { userId: input.userId }),
    ),

  leave: protectedProcedure
    .input(homeIdInput)
    .output(homeIdInput)
    .mutation(async ({ ctx, input }) => leaveHome(ctx.user, input.homeId)),
});
