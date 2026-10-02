import "server-only";
import {
  invalidateBoardCache,
  publishBoardEvent,
  publishHomeEvent,
} from "@noted/realtime/src";
import type { BoardEvent, MediaEvent } from "@noted/validators/src";

// Fan-out after every board mutation: invalidate first so subscribers'
// refetches rebuild from fresh Postgres rows, then publish. Membership
// changes reuse it so a revoked member's stream ends at once.
export async function boardChanged(boardId: string): Promise<void> {
  await invalidateBoardCache(boardId);
  await publishBoardEvent(boardId, {
    type: "board-changed",
    boardId,
  } satisfies BoardEvent);
}

// Fan-out after every home media change (reels, book, processing): TV and
// Book subscribers refetch on every one. Membership changes reuse it so an
// ex-member's media stream rechecks and ends at once.
export async function mediaChanged(homeId: string): Promise<void> {
  await publishHomeEvent(homeId, {
    type: "media-changed",
    homeId,
  } satisfies MediaEvent);
}
