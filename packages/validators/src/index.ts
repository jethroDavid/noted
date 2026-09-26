import { z } from "zod";

export const helloInput = z.object({
  name: z.string().min(1).max(100).optional(),
});

export type HelloInput = z.infer<typeof helloInput>;

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
  createdAt: z.date(),
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

// Mirrors PHOTO_FIXTURES in @noted/domain; this package cannot import that
// leaf sibling, so an api test guards that the two key lists stay in sync.
export const photoFixtureKeySchema = z.enum([
  "lake",
  "living-room",
  "moonlit-bedroom",
]);

export const createTextPostSchema = z.object({
  text: postTextSchema,
  foregroundColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});
export const createPhotoPostSchema = z.object({
  fixture: photoFixtureKeySchema,
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

const textPostSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  kind: z.literal("text"),
  text: z.string(),
  foregroundColor: z.string(),
  backgroundColor: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletionRequestedAt: z.date().nullable(),
  deleteAfter: z.date().nullable(),
});
const photoPostSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  kind: z.literal("photo"),
  imageUrl: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const boardPostSchema = z.discriminatedUnion("kind", [
  textPostSchema,
  photoPostSchema,
]);
export const boardPostsResponseSchema = z.object({
  board: z.object({
    id: z.uuid(),
    homeId: z.uuid(),
    postAdditions: z.number().int().nonnegative(),
  }),
  posts: z.array(boardPostSchema),
  serverTime: z.date(),
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

export type Home = z.infer<typeof homeSchema>;
export type HomeDetail = z.infer<typeof homeDetailSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type BoardPost = z.infer<typeof boardPostSchema>;
export type BoardPostsResponse = z.infer<typeof boardPostsResponseSchema>;
export type CreateTextPostInput = z.infer<typeof createTextPostSchema>;
export type CreatePhotoPostInput = z.infer<typeof createPhotoPostSchema>;
export type UpdatePostContentInput = z.infer<typeof updatePostContentSchema>;
export type UpdatePostPositionInput = z.infer<typeof updatePostPositionSchema>;
export type PhotoFixtureKey = z.infer<typeof photoFixtureKeySchema>;
