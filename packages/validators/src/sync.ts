import { z } from "zod";
import {
  createTextPostSchema,
  hexColorSchema,
  normalizedCoordinateSchema,
  postTextSchema,
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
export type NoteOperation = z.infer<typeof noteOperationSchema>;
export type NoteOutcome = z.infer<typeof noteOutcomeSchema>;
