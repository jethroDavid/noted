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

export const createTextPostSchema = z.object({
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
// Display state for upload-backed media, derived server-side from the asset
// row (see mediaDisplayStatus in @noted/domain): uploading (bytes not
// confirmed) and processing (bytes confirmed, variant not written) render a
// spinner with null URLs; ready serves viewable URLs.
export const mediaDisplayStatusSchema = z.enum([
  "uploading",
  "processing",
  "ready",
]);

const photoPostSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  kind: z.literal("photo"),
  status: mediaDisplayStatusSchema,
  // Ready uploads serve the original plus a small variant; legacy bundled
  // keys serve the original for both. Non-ready posts carry nulls and
  // render a spinner.
  imageUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
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

// Upload rules (Phase 3): the single allowlist for presigned uploads.
// packages/media mirrors the content types for key extensions (a leaf that
// cannot import this sibling); drift throws loudly at upload time.
export const UPLOAD_RULES = {
  photo: {
    contentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 10 * 1024 * 1024,
  },
  video: {
    contentTypes: ["video/mp4", "video/webm"],
    maxBytes: 100 * 1024 * 1024,
  },
} as const;

export const assetIdSchema = z.uuid();
export const reelIdSchema = z.uuid();
export const bookEntryIdSchema = z.uuid();

export const requestUploadSchema = z
  .object({
    homeId: homeIdSchema,
    kind: z.enum(["photo", "video"]),
    contentType: z.string().min(1),
    byteSize: z.number().int().positive(),
  })
  .superRefine((input, ctx) => {
    const rules = UPLOAD_RULES[input.kind];
    if (
      !(rules.contentTypes as readonly string[]).includes(input.contentType)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["contentType"],
        message: `Unsupported ${input.kind} content type: ${input.contentType}`,
      });
    }
    if (input.byteSize > rules.maxBytes) {
      ctx.addIssue({
        code: "custom",
        path: ["byteSize"],
        message: `${input.kind} uploads are capped at ${rules.maxBytes} bytes.`,
      });
    }
  });

export const uploadTicketSchema = z.object({
  assetId: assetIdSchema,
  uploadUrl: z.string().url(),
});

export const createUploadedPhotoSchema = z.object({
  assetId: assetIdSchema,
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});

export const createReelSchema = z.object({ assetId: assetIdSchema });

// Sent after the browser's background PUT lands: flips a pending asset to
// attached and queues variant processing. Idempotent under retry.
export const confirmUploadSchema = z.object({ assetId: assetIdSchema });

export const reelSchema = z.object({
  id: reelIdSchema,
  homeId: homeIdSchema,
  status: mediaDisplayStatusSchema,
  // Null until the reel is ready (poster written); non-ready reels render
  // a spinner. Fixture reels are ready with the original and no poster.
  videoUrl: z.string().min(1).nullable(),
  posterUrl: z.string().min(1).nullable(),
  createdAt: z.date(),
  // Computed server-side (createdAt plus the domain reel lifetime): the
  // sweep archives the reel to the photobook once this passes. Null for
  // fixture reels, which stay on TV permanently and are never swept.
  expiresAt: z.date().nullable(),
});
export const reelsResponseSchema = z.object({ reels: z.array(reelSchema) });

const photoBookEntrySchema = z.object({
  kind: z.literal("photo"),
  id: bookEntryIdSchema,
  thumbnailUrl: z.string().min(1),
  imageUrl: z.string().min(1),
  archivedAt: z.date(),
});
const clipBookEntrySchema = z.object({
  kind: z.literal("clip"),
  id: bookEntryIdSchema,
  // Null for posterless clips (poster generation failed): the page shows a
  // placeholder tile and the modal still plays the video.
  posterUrl: z.string().min(1).nullable(),
  videoUrl: z.string().min(1),
  archivedAt: z.date(),
});
// Book entries take the shape of the archived asset's kind: fridge photos
// archive with a thumbnail, swept reels with a poster frame.
export const bookEntrySchema = z.discriminatedUnion("kind", [
  photoBookEntrySchema,
  clipBookEntrySchema,
]);
export const bookResponseSchema = z.object({
  entries: z.array(bookEntrySchema),
});

// Home media events (Phase 3) are invalidation signals like board events:
// TV and Book subscribers refetch on every one.
export const mediaChangedEventSchema = z.object({
  type: z.literal("media-changed"),
  homeId: homeIdSchema,
});
export const mediaEventSchema = z.discriminatedUnion("type", [
  mediaChangedEventSchema,
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
export type UpdatePostContentInput = z.infer<typeof updatePostContentSchema>;
export type UpdatePostPositionInput = z.infer<typeof updatePostPositionSchema>;
export type RestorePostInput = z.infer<typeof restorePostSchema>;
export type RestorePhotoPostInput = z.infer<typeof restorePhotoPostSchema>;
export type RestoreAnyPostInput = z.infer<typeof restoreAnyPostSchema>;
export type UploadKind = keyof typeof UPLOAD_RULES;
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;
export type UploadTicket = z.infer<typeof uploadTicketSchema>;
export type CreateUploadedPhotoInput = z.infer<
  typeof createUploadedPhotoSchema
>;
export type CreateReelInput = z.infer<typeof createReelSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type MediaDisplayStatus = z.infer<typeof mediaDisplayStatusSchema>;
export type Reel = z.infer<typeof reelSchema>;
export type ReelsResponse = z.infer<typeof reelsResponseSchema>;
export type BookEntry = z.infer<typeof bookEntrySchema>;
export type BookResponse = z.infer<typeof bookResponseSchema>;
export type MediaEvent = z.infer<typeof mediaEventSchema>;
