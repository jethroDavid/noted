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
// Restores a just-deleted text note with its original identity, content,
// position, and creation time, so Undo returns it exactly as it was.
export const restorePostSchema = z.object({
  postId: postIdSchema,
  text: postTextSchema,
  foregroundColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
  createdAt: z.date(),
});
// Restores a just-archived photo note with its original identity, position,
// and creation time. The image itself is recovered server-side from the book
// entry written by the archive, so the client sends no media reference.
export const restorePhotoPostSchema = z.object({
  postId: postIdSchema,
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
  createdAt: z.date(),
});
// The single Undo payload for every post kind. A new kind adds one variant
// here; the Record lookups and exhaustive switches over it then fail to
// compile until each one handles the new kind.
export const restoreAnyPostSchema = z.discriminatedUnion("kind", [
  restorePostSchema.extend({ kind: z.literal("text") }),
  restorePhotoPostSchema.extend({ kind: z.literal("photo") }),
]);

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

// Board realtime events (Phase 2) are invalidation signals, not patches:
// every subscriber refetches the board, and the refetch is served from
// the Redis cache. A new event adds one variant here; switches over the
// discriminator then fail to compile until each one handles it.
export const boardViewerSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.email(),
});
export const boardChangedEventSchema = z.object({
  type: z.literal("board-changed"),
  boardId: boardIdSchema,
});
export const boardPresenceEventSchema = z.object({
  type: z.literal("presence"),
  boardId: boardIdSchema,
  viewers: z.array(boardViewerSchema),
});
export const boardEventSchema = z.discriminatedUnion("type", [
  boardChangedEventSchema,
  boardPresenceEventSchema,
]);

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
export type BoardViewer = z.infer<typeof boardViewerSchema>;
export type BoardEvent = z.infer<typeof boardEventSchema>;
export type BoardPresenceEvent = z.infer<typeof boardPresenceEventSchema>;
export type CreateTextPostInput = z.infer<typeof createTextPostSchema>;
export type CreatePhotoPostInput = z.infer<typeof createPhotoPostSchema>;
export type UpdatePostContentInput = z.infer<typeof updatePostContentSchema>;
export type UpdatePostPositionInput = z.infer<typeof updatePostPositionSchema>;
export type RestorePostInput = z.infer<typeof restorePostSchema>;
export type RestorePhotoPostInput = z.infer<typeof restorePhotoPostSchema>;
export type RestoreAnyPostInput = z.infer<typeof restoreAnyPostSchema>;
export type PhotoFixtureKey = z.infer<typeof photoFixtureKeySchema>;
