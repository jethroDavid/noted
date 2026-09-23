import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

test.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "shared text posts, last-save-wins, removal, Undo, and expiry",
  async () => {
    const { database, homes, posts, users } = await import("@noted/database");
    const { eq, inArray } = await import("drizzle-orm");
    const { syncVerifiedUser } = await import("./identity");
    const { createHome, inviteMember } = await import("./homes");
    const {
      createTextPost,
      editPostContent,
      movePost,
      readBoard,
      requestRemoval,
      undoRemoval,
    } = await import("./posts");

    const suffix = randomUUID();
    const userIds: string[] = [];
    let homeId: string | null = null;
    try {
      const alice = await syncVerifiedUser({
        subject: `test-alice-posts-${suffix}`,
        email: `alice-posts-${suffix}@example.test`,
        displayName: "Alice",
      });
      userIds.push(alice.id);
      const bob = await syncVerifiedUser({
        subject: `test-bob-posts-${suffix}`,
        email: `bob-posts-${suffix}@example.test`,
        displayName: "Bob",
      });
      userIds.push(bob.id);
      const carol = await syncVerifiedUser({
        subject: `test-carol-posts-${suffix}`,
        email: `carol-posts-${suffix}@example.test`,
        displayName: "Carol",
      });
      userIds.push(carol.id);

      const home = await createHome(alice, "Phase five home");
      homeId = home.id;
      const boardId = home.boardId;
      await inviteMember(alice, home.id, bob.email);

      await expect(readBoard(carol, home.id, boardId)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        readBoard(alice, home.id, randomUUID()),
      ).rejects.toMatchObject({ status: 404 });

      const empty = await readBoard(alice, home.id, boardId);
      expect(empty.posts).toHaveLength(0);
      expect(empty.board.postAdditions).toBe(0);
      expect(Date.parse(empty.serverTime)).not.toBeNaN();

      const first = await createTextPost(alice, home.id, boardId, {
        text: "Oat milk",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
        x: 0.3,
        y: 0.4,
      });
      expect(first.text).toBe("Oat milk");
      const second = await createTextPost(bob, home.id, boardId, {
        text: "Sunday dinner",
        foregroundColor: "#33352e",
        backgroundColor: "#dcd5ed",
        x: 0.6,
        y: 0.7,
      });

      const shared = await readBoard(bob, home.id, boardId);
      expect(shared.posts.map((post) => post.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(shared.board.postAdditions).toBe(2);

      const edited = await editPostContent(bob, home.id, first.id, {
        text: "Oat milk and strawberries",
        foregroundColor: "#344e40",
        backgroundColor: "#f5dfa0",
      });
      expect(edited.text).toBe("Oat milk and strawberries");
      expect({ x: edited.x, y: edited.y }).toEqual({ x: 0.3, y: 0.4 });

      const moved = await movePost(alice, home.id, first.id, {
        x: 0.5,
        y: 0.6,
      });
      expect({ x: moved.x, y: moved.y }).toEqual({ x: 0.5, y: 0.6 });
      expect(moved.text).toBe("Oat milk and strawberries");

      const [raceA, raceB] = await Promise.all([
        editPostContent(alice, home.id, second.id, {
          text: "Dinner at six",
          foregroundColor: "#33352e",
          backgroundColor: "#dcd5ed",
        }),
        editPostContent(bob, home.id, second.id, {
          text: "Dinner at seven",
          foregroundColor: "#33352e",
          backgroundColor: "#dcd5ed",
        }),
      ]);
      expect([raceA.text, raceB.text].sort()).toEqual([
        "Dinner at seven",
        "Dinner at six",
      ]);
      const raced = await readBoard(alice, home.id, boardId);
      expect(raced.posts.find((post) => post.id === second.id)?.text).toMatch(
        /^Dinner at (six|seven)$/,
      );

      await expect(
        editPostContent(bob, home.id, randomUUID(), {
          text: "nope",
          foregroundColor: "#33352e",
          backgroundColor: "#f5dfa0",
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        movePost(carol, home.id, first.id, { x: 0.1, y: 0.1 }),
      ).rejects.toMatchObject({ status: 404 });

      const pending = await requestRemoval(alice, home.id, first.id);
      expect(pending.deletionRequestedAt).not.toBeNull();
      expect(pending.deleteAfter).not.toBeNull();
      const repeated = await requestRemoval(bob, home.id, first.id);
      expect(repeated.deleteAfter).toBe(pending.deleteAfter);

      await expect(
        editPostContent(alice, home.id, first.id, {
          text: "changed while grey",
          foregroundColor: "#33352e",
          backgroundColor: "#f5dfa0",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        movePost(alice, home.id, first.id, { x: 0.1, y: 0.1 }),
      ).rejects.toMatchObject({ status: 409 });

      const restored = await undoRemoval(bob, home.id, first.id);
      expect(restored.deletionRequestedAt).toBeNull();
      expect(restored.deleteAfter).toBeNull();
      expect(
        (await readBoard(alice, home.id, boardId)).posts.map((post) => post.id),
      ).toContain(first.id);

      await requestRemoval(alice, home.id, first.id);
      await database
        .update(posts)
        .set({
          deletionRequestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          deleteAfter: new Date(Date.now() - 1000),
        })
        .where(eq(posts.id, first.id));

      const afterExpiry = await readBoard(alice, home.id, boardId);
      expect(afterExpiry.posts.map((post) => post.id)).not.toContain(first.id);
      await expect(undoRemoval(bob, home.id, first.id)).rejects.toMatchObject({
        status: 409,
      });
      await expect(
        editPostContent(alice, home.id, first.id, {
          text: "resurrection attempt",
          foregroundColor: "#33352e",
          backgroundColor: "#f5dfa0",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        requestRemoval(alice, home.id, first.id),
      ).rejects.toMatchObject({ status: 409 });

      const racer = await createTextPost(alice, home.id, boardId, {
        text: "race me",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
        x: 0.2,
        y: 0.2,
      });
      const outcomes = await Promise.allSettled([
        requestRemoval(alice, home.id, racer.id),
        undoRemoval(bob, home.id, racer.id),
      ]);
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") {
          expect(outcome.reason).toMatchObject({ status: 409 });
        }
      }
      const [racerRow] = await database
        .select({
          deletionRequestedAt: posts.deletionRequestedAt,
          deleteAfter: posts.deleteAfter,
        })
        .from(posts)
        .where(eq(posts.id, racer.id))
        .limit(1);
      const settled =
        !racerRow || racerRow.deleteAfter === null
          ? "live"
          : racerRow.deleteAfter.getTime() > Date.now()
            ? "pending"
            : "expired";
      expect(["live", "pending"]).toContain(settled);
      if (settled === "pending") {
        await undoRemoval(alice, home.id, racer.id);
      }

      const additions = (await readBoard(alice, home.id, boardId)).board
        .postAdditions;
      await editPostContent(alice, home.id, second.id, {
        text: "Dinner at eight",
        foregroundColor: "#33352e",
        backgroundColor: "#dcd5ed",
      });
      await movePost(alice, home.id, second.id, { x: 0.65, y: 0.7 });
      await requestRemoval(alice, home.id, second.id);
      await undoRemoval(alice, home.id, second.id);
      expect(
        (await readBoard(alice, home.id, boardId)).board.postAdditions,
      ).toBe(additions);
    } finally {
      if (homeId) await database.delete(homes).where(eq(homes.id, homeId));
      if (userIds.length)
        await database.delete(users).where(inArray(users.id, userIds));
    }
  },
);
