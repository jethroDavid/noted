import "server-only";
import { createHash } from "node:crypto";
import {
  boards,
  db,
  homeMemberships,
  noteRevisions,
  posts,
  syncReceipts,
} from "@noted/db/src";
import type { NoteOperation, NoteOutcome } from "@noted/validators/sync";
import { noteOperationSchema, noteOutcomeSchema } from "@noted/validators/sync";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { boardChanged } from "./events";
import type { CurrentUser } from "./identity";

export async function readNoteHistory(
  user: CurrentUser,
  homeId: string,
  postId: string,
  options: { month?: string; beforeRevision?: number } = {},
) {
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(boards, eq(boards.id, posts.boardId))
    .innerJoin(homeMemberships, eq(homeMemberships.homeId, boards.homeId))
    .where(
      and(
        eq(posts.id, postId),
        eq(boards.homeId, homeId),
        eq(homeMemberships.userId, user.id),
      ),
    );
  if (!post)
    throw new TRPCError({ code: "NOT_FOUND", message: "Note not found." });
  const from = options.month
    ? new Date(`${options.month}-01T00:00:00Z`)
    : undefined;
  const until = from
    ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
    : undefined;
  const revisions = await db
    .select({
      revision: noteRevisions.revision,
      text: noteRevisions.text,
      foregroundColor: noteRevisions.foregroundColor,
      backgroundColor: noteRevisions.backgroundColor,
      createdAt: noteRevisions.createdAt,
    })
    .from(noteRevisions)
    .where(
      and(
        eq(noteRevisions.postId, postId),
        from ? gte(noteRevisions.createdAt, from) : undefined,
        until ? lt(noteRevisions.createdAt, until) : undefined,
        options.beforeRevision
          ? lt(noteRevisions.revision, options.beforeRevision)
          : undefined,
      ),
    )
    .orderBy(desc(noteRevisions.revision))
    .limit(101);
  return {
    revisions: revisions.slice(0, 100),
    hasMore: revisions.length > 100,
  };
}

// Canonical JSON makes receipt identity independent of transport key order.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function applyNoteOperation(
  user: CurrentUser,
  input: NoteOperation,
  database: typeof db = db,
): Promise<NoteOutcome> {
  // Validate even service callers; only these domain fields can reach SQL.
  const operation = noteOperationSchema.parse(input);
  const fingerprint = createHash("sha256")
    .update(canonical(operation))
    .digest("hex");
  const outcome = await database.transaction(
    async (tx): Promise<NoteOutcome> => {
      // A concurrent DELETE of membership must wait until this transaction
      // commits. A write that starts after revocation sees no membership.
      const [member] = await tx
        .select({ userId: homeMemberships.userId })
        .from(homeMemberships)
        .where(
          and(
            eq(homeMemberships.userId, user.id),
            eq(homeMemberships.homeId, operation.homeId),
          ),
        )
        .for("share");
      if (!member) return { code: "ACCESS_REVOKED" };

      // The unique receipt key serializes simultaneous delivery of one
      // operation. Its placeholder is never committed independently.
      const [reserved] = await tx
        .insert(syncReceipts)
        .values({
          userId: user.id,
          operationId: operation.operationId,
          fingerprint,
          outcome: { pending: true },
        })
        .onConflictDoNothing()
        .returning({ operationId: syncReceipts.operationId });
      if (!reserved) {
        const [receipt] = await tx
          .select()
          .from(syncReceipts)
          .where(
            and(
              eq(syncReceipts.userId, user.id),
              eq(syncReceipts.operationId, operation.operationId),
            ),
          );
        if (!receipt) throw new Error("Missing committed sync receipt.");
        if (receipt.fingerprint !== fingerprint)
          return {
            code: "INVALID_OPERATION",
            message:
              "This operation ID was already used for a different change.",
          };
        return noteOutcomeSchema.parse(receipt.outcome);
      }

      async function finish(result: NoteOutcome): Promise<NoteOutcome> {
        await tx
          .update(syncReceipts)
          .set({ outcome: result })
          .where(
            and(
              eq(syncReceipts.userId, user.id),
              eq(syncReceipts.operationId, operation.operationId),
            ),
          );
        return result;
      }

      const [board] = await tx
        .select({ id: boards.id })
        .from(boards)
        .where(
          and(
            eq(boards.id, operation.boardId),
            eq(boards.homeId, operation.homeId),
          ),
        )
        .for("share");
      if (!board)
        return finish({
          code: "INVALID_OPERATION",
          message: "The board does not belong to this home.",
        });

      let [post] = await tx
        .select()
        .from(posts)
        .where(eq(posts.id, operation.postId))
        .for("update");
      if (post && (post.boardId !== board.id || post.kind !== "text")) {
        return finish({
          code: "INVALID_OPERATION",
          message: "This operation cannot change that item.",
        });
      }

      const now = new Date();
      if (operation.kind === "create") {
        if (post)
          return finish({
            code: "INVALID_OPERATION",
            message: "That item ID already exists.",
          });
        [post] = await tx
          .insert(posts)
          .values({
            id: operation.postId,
            boardId: board.id,
            creatorUserId: user.id,
            kind: "text",
            textContent: operation.value.text,
            foregroundColor: operation.value.foregroundColor,
            backgroundColor: operation.value.backgroundColor,
            positionX: operation.value.x,
            positionY: operation.value.y,
          })
          .onConflictDoNothing()
          .returning();
        if (!post)
          return finish({
            code: "INVALID_OPERATION",
            message: "That item ID already exists.",
          });
      } else {
        if (!post || post.deletedAt) {
          if (post && operation.kind === "delete")
            return finish({ code: "ACCEPTED", revision: post.revision });
          return finish({ code: "ITEM_DELETED" });
        }
        if (
          operation.kind === "delete" &&
          operation.expectedRevision !== post.revision
        ) {
          return finish({
            code: "DELETE_REQUIRES_CONFIRMATION",
            revision: post.revision,
          });
        }
        const patch =
          operation.kind === "edit"
            ? {
                ...(operation.patch.text !== undefined
                  ? { textContent: operation.patch.text }
                  : {}),
                ...(operation.patch.foregroundColor !== undefined
                  ? { foregroundColor: operation.patch.foregroundColor }
                  : {}),
                ...(operation.patch.backgroundColor !== undefined
                  ? { backgroundColor: operation.patch.backgroundColor }
                  : {}),
              }
            : operation.kind === "move"
              ? { positionX: operation.x, positionY: operation.y }
              : { deletedAt: now };
        [post] = await tx
          .update(posts)
          .set({ ...patch, revision: post.revision + 1, updatedAt: now })
          .where(eq(posts.id, operation.postId))
          .returning();
        if (!post) throw new Error("Locked note disappeared.");
      }

      if (operation.kind === "create" || operation.kind === "edit") {
        await tx.insert(noteRevisions).values({
          postId: post.id,
          revision: post.revision,
          userId: user.id,
          operationId: operation.operationId,
          text: post.textContent!,
          foregroundColor: post.foregroundColor,
          backgroundColor: post.backgroundColor,
        });
      }
      if (operation.kind === "create")
        await tx
          .update(boards)
          .set({ postAdditions: sql`${boards.postAdditions} + 1` })
          .where(eq(boards.id, board.id));
      return finish({ code: "ACCEPTED", revision: post.revision });
    },
  );

  // Native correctness uses PostgreSQL replication, not this best-effort
  // browser invalidation. Failure after commit must not hide acceptance.
  if (outcome.code === "ACCEPTED") {
    try {
      await boardChanged(operation.boardId);
    } catch {
      console.error(
        "Could not invalidate the board after a committed sync operation.",
      );
    }
  }
  return outcome;
}
