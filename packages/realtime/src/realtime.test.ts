import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  boardCacheKey,
  commands,
  invalidateBoardCache,
  isBoardViewerLive,
  leaveBoardPresence,
  listBoardViewers,
  presenceLastSeenKey,
  presencePayloadsKey,
  publishBoardEvent,
  readBoardCache,
  refreshBoardPresence,
  subscribeToBoard,
  writeBoardCache,
} from "./index";

// Realtime tests run against real Redis (local compose on 6380, or the
// REDIS_URL CI sets for its service). Every test uses a random board id
// and deletes its keys afterwards, so runs never touch dev data.
async function cleanup(boardId: string) {
  await commands.del(
    boardCacheKey(boardId),
    presenceLastSeenKey(boardId),
    presencePayloadsKey(boardId),
  );
}

afterAll(() => {
  commands.disconnect();
});

describe("board rooms", () => {
  it("fans out a published event to every subscriber", async () => {
    const boardId = randomUUID();
    try {
      const received: unknown[] = [];
      const collect = (event: unknown) => {
        received.push(event);
      };
      const leaveA = await subscribeToBoard(boardId, collect);
      const leaveB = await subscribeToBoard(boardId, collect);
      try {
        await publishBoardEvent(boardId, {
          type: "board-changed",
          boardId,
        });
        await vi.waitFor(() => expect(received).toHaveLength(2));
      } finally {
        await leaveA();
        await leaveB();
      }
      expect(received).toEqual([
        { type: "board-changed", boardId },
        { type: "board-changed", boardId },
      ]);
    } finally {
      await cleanup(boardId);
    }
  });

  it("stops delivering after unsubscribe", async () => {
    const boardId = randomUUID();
    try {
      const received: unknown[] = [];
      const leave = await subscribeToBoard(boardId, (event) =>
        received.push(event),
      );
      await leave();
      await publishBoardEvent(boardId, { type: "board-changed", boardId });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toHaveLength(0);
    } finally {
      await cleanup(boardId);
    }
  });
});

describe("board cache", () => {
  it("round-trips a board read including Dates", async () => {
    const boardId = randomUUID();
    try {
      const board = {
        board: { id: boardId, homeId: randomUUID(), postAdditions: 2 },
        posts: [],
        serverTime: new Date("2026-09-26T12:00:00.000Z"),
      };
      await writeBoardCache(boardId, board);
      expect(await readBoardCache(boardId)).toEqual(board);
    } finally {
      await cleanup(boardId);
    }
  });

  it("misses before write and after invalidate", async () => {
    const boardId = randomUUID();
    try {
      expect(await readBoardCache(boardId)).toBeNull();
      await writeBoardCache(boardId, { board: boardId });
      await invalidateBoardCache(boardId);
      expect(await readBoardCache(boardId)).toBeNull();
    } finally {
      await cleanup(boardId);
    }
  });
});

describe("board presence", () => {
  const ada = {
    userId: randomUUID(),
    displayName: "Ada",
    email: "ada@example.test",
  };
  const grace = {
    userId: randomUUID(),
    displayName: null,
    email: "grace@example.test",
  };

  it("lists viewers in email order and drops leavers", async () => {
    const boardId = randomUUID();
    try {
      await refreshBoardPresence(boardId, grace);
      await refreshBoardPresence(boardId, ada);
      expect(await listBoardViewers(boardId)).toEqual([ada, grace]);
      await leaveBoardPresence(boardId, ada.userId);
      expect(await listBoardViewers(boardId)).toEqual([grace]);
    } finally {
      await cleanup(boardId);
    }
  });

  it("reports liveness only for viewers with a fresh refresh", async () => {
    const boardId = randomUUID();
    try {
      expect(await isBoardViewerLive(boardId, ada.userId)).toBe(false);
      await refreshBoardPresence(boardId, ada);
      expect(await isBoardViewerLive(boardId, ada.userId)).toBe(true);
      await commands.zadd(
        presenceLastSeenKey(boardId),
        Date.now() - 61_000,
        ada.userId,
      );
      expect(await isBoardViewerLive(boardId, ada.userId)).toBe(false);
      await refreshBoardPresence(boardId, ada);
      await leaveBoardPresence(boardId, ada.userId);
      expect(await isBoardViewerLive(boardId, ada.userId)).toBe(false);
    } finally {
      await cleanup(boardId);
    }
  });

  it("prunes viewers whose refresh aged out", async () => {
    const boardId = randomUUID();
    try {
      await refreshBoardPresence(boardId, ada);
      // Age the refresh out directly: waiting out the real 60s window would
      // stall the suite, and the cutoff itself is what this checks.
      await commands.zadd(
        presenceLastSeenKey(boardId),
        Date.now() - 61_000,
        ada.userId,
      );
      expect(await listBoardViewers(boardId)).toEqual([]);
      expect(await commands.hlen(presencePayloadsKey(boardId))).toBe(0);
    } finally {
      await cleanup(boardId);
    }
  });
});
