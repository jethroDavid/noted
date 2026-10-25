import { z } from "zod";
import {
  createTextPostSchema,
  hexColorSchema,
  normalizedCoordinateSchema,
  postTextSchema,
  requestUploadSchema,
} from "./index";

const context = z.object({
  operationId: z.uuid(),
  homeId: z.uuid(),
  boardId: z.uuid(),
  postId: z.uuid(),
});

const textPatch = z
  .strictObject({
    text: postTextSchema.optional(),
    foregroundColor: hexColorSchema.optional(),
    backgroundColor: hexColorSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "An edit must change at least one field.",
  );

export const noteOperationSchema = z.discriminatedUnion("kind", [
  context.extend({ kind: z.literal("create"), value: createTextPostSchema }),
  context.extend({ kind: z.literal("edit"), patch: textPatch }),
  context.extend({
    kind: z.literal("move"),
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  }),
  context.extend({
    kind: z.literal("delete"),
    expectedRevision: z.number().int().positive(),
  }),
]);

export const noteOutcomeSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("ACCEPTED"),
    revision: z.number().int().positive(),
  }),
  z.object({ code: z.literal("ACCESS_REVOKED") }),
  z.object({ code: z.literal("ITEM_DELETED") }),
  z.object({
    code: z.literal("DELETE_REQUIRES_CONFIRMATION"),
    revision: z.number().int().positive(),
  }),
  z.object({ code: z.literal("INVALID_OPERATION"), message: z.string() }),
]);

export const syncCredentialsSchema = z.object({
  endpoint: z.url(),
  token: z.string().min(1),
});
export const noteHistorySchema = z.object({
  hasMore: z.boolean(),
  revisions: z.array(
    z.object({
      revision: z.number().int().positive(),
      text: z.string(),
      foregroundColor: z.string(),
      backgroundColor: z.string(),
      createdAt: z.date(),
    }),
  ),
});
export type NoteOperation = z.infer<typeof noteOperationSchema>;
export type NoteOutcome = z.infer<typeof noteOutcomeSchema>;

const mediaContext = z.object({
  operationId: z.uuid(),
  homeId: z.uuid(),
  itemId: z.uuid(),
});
const mediaUpload = requestUploadSchema.safeExtend({
  checksum: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
});
export const mediaOperationSchema = z.discriminatedUnion("kind", [
  mediaContext.extend({
    kind: z.literal("restore-photo"),
    archivedItemId: z.uuid(),
    boardId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  }),
  mediaContext.extend({
    kind: z.literal("create-photo"),
    boardId: z.uuid(),
    assetId: z.uuid(),
    upload: mediaUpload,
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  }),
  mediaContext.extend({
    kind: z.literal("create-video"),
    assetId: z.uuid(),
    upload: mediaUpload,
  }),
  mediaContext.extend({
    kind: z.literal("move-photo"),
    boardId: z.uuid(),
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,
  }),
  mediaContext.extend({
    kind: z.enum(["archive-photo", "archive-video", "delete-book"]),
    expectedRevision: z.number().int().positive(),
  }),
]);
export type MediaOperation = z.infer<typeof mediaOperationSchema>;
export const mediaTicketSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("UPLOAD"), uploadUrl: z.url() }),
  z.object({ code: z.literal("VERIFIED") }),
  z.object({ code: z.enum(["ACCESS_REVOKED", "ITEM_DELETED"]) }),
]);
