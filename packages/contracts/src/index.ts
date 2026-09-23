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
  .string()
  .trim()
  .pipe(z.email())
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
export const boardIdSchema = z.uuid();
export const postIdSchema = z.uuid();
export const postTextSchema = z.string().trim().min(1).max(2000);
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const normalizedCoordinateSchema = z
  .number()
  .min(0)
  .max(1)
  .refine(Number.isFinite, "A board coordinate must be a finite number.");
export const createPostSchema = z.object({
  text: postTextSchema,
  foregroundColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});
export const updatePostContentSchema = z.object({
  text: postTextSchema,
  foregroundColor: hexColorSchema,
  backgroundColor: hexColorSchema,
});
export const updatePostPositionSchema = z.object({
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});
export const boardPostSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  kind: z.literal("text"),
  text: z.string(),
  foregroundColor: z.string(),
  backgroundColor: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletionRequestedAt: z.iso.datetime().nullable(),
  deleteAfter: z.iso.datetime().nullable(),
});
export const boardPostsResponseSchema = z.object({
  board: z.object({
    id: z.uuid(),
    homeId: z.uuid(),
    postAdditions: z.number().int().nonnegative(),
  }),
  posts: z.array(boardPostSchema),
  serverTime: z.iso.datetime(),
});
export const postResponseSchema = z.object({ post: boardPostSchema });
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
export type BoardPost = z.infer<typeof boardPostSchema>;
export type BoardPostsResponse = z.infer<typeof boardPostsResponseSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostContentInput = z.infer<typeof updatePostContentSchema>;
export type UpdatePostPositionInput = z.infer<typeof updatePostPositionSchema>;
