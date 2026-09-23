import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

test.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "expired text-post pruning keeps live posts",
  async () => {
    const { boards, database, homes, posts, users } = await import("./index");
    const { eq } = await import("drizzle-orm");
    const { countExpiredTextPosts, pruneExpiredTextPosts } =
      await import("./maintenance");

    const suffix = randomUUID().replace(/-/g, "");
    const userId = randomUUID();
    const homeId = randomUUID();
    const boardId = randomUUID();
    const liveId = randomUUID();
    const expiredId = randomUUID();
    try {
      await database.insert(users).values({
        id: userId,
        authSubject: `prune-${suffix}`,
        email: `prune-${suffix}@example.test`,
        displayName: null,
      });
      await database.insert(homes).values({
        id: homeId,
        name: "Prune home",
        creatorUserId: userId,
      });
      await database.insert(boards).values({
        id: boardId,
        homeId,
        kind: "fridge",
      });
      await database.insert(posts).values([
        {
          id: liveId,
          boardId,
          creatorUserId: userId,
          kind: "text",
          textContent: "live",
          foregroundColor: "#33352e",
          backgroundColor: "#f5dfa0",
          positionX: 0.5,
          positionY: 0.5,
        },
        {
          id: expiredId,
          boardId,
          creatorUserId: userId,
          kind: "text",
          textContent: "expired",
          foregroundColor: "#33352e",
          backgroundColor: "#f5dfa0",
          positionX: 0.5,
          positionY: 0.5,
          deletionRequestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          deleteAfter: new Date(Date.now() - 1000),
        },
      ]);

      // Counting never changes rows.
      expect(await countExpiredTextPosts()).toBeGreaterThanOrEqual(1);
      const before = await countExpiredTextPosts();
      expect(await countExpiredTextPosts()).toBe(before);

      const removed = await pruneExpiredTextPosts();
      expect(removed).toBeGreaterThanOrEqual(1);
      const remaining = await database
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.boardId, boardId));
      expect(remaining.map((row) => row.id)).toEqual([liveId]);
    } finally {
      await database.delete(homes).where(eq(homes.id, homeId));
      await database.delete(users).where(eq(users.id, userId));
    }
  },
);
