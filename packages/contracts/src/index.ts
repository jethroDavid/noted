import { z } from "zod";

export const healthResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    database: z.literal("connected"),
  }),
  z.object({
    status: z.literal("error"),
    database: z.literal("unavailable"),
  }),
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const homeIdSchema = z.uuid();
export const homeNameSchema = z.string().trim().min(1).max(80);
export const inviteEmailSchema = z
  .email()
  .trim()
  .transform((email) => email.toLowerCase());
export const createHomeSchema = z.object({ name: homeNameSchema });
export const renameHomeSchema = createHomeSchema;
export const inviteMemberSchema = z.object({ email: inviteEmailSchema });

export const memberSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  isCreator: z.boolean(),
});
export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
export const homeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  boardId: z.uuid(),
  creatorUserId: z.uuid(),
  role: z.enum(["creator", "member"]),
});
export const homeDetailSchema = homeSchema.extend({
  members: z.array(memberSchema),
  pendingInvitations: z.array(invitationSchema),
});
export const meResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().nullable(),
  }),
  homes: z.array(homeSchema),
});
export const homesResponseSchema = z.object({ homes: z.array(homeSchema) });
export const homeResponseSchema = z.object({ home: homeDetailSchema });
export const errorResponseSchema = z.object({ error: z.string() });

export type Home = z.infer<typeof homeSchema>;
export type HomeDetail = z.infer<typeof homeDetailSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
