import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

test.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "home membership, invitation claim, creator controls, and stale access",
  async () => {
    const { database, homes, users } = await import("@noted/database");
    const { eq, inArray } = await import("drizzle-orm");
    const { syncVerifiedUser } = await import("./identity");
    const {
      createHome,
      getHome,
      inviteMember,
      leaveHome,
      listHomes,
      removeMember,
      renameHome,
    } = await import("./homes");

    const suffix = randomUUID();
    const userIds: string[] = [];
    let homeId: string | null = null;
    try {
      const alice = await syncVerifiedUser({
        subject: `test-alice-${suffix}`,
        email: `alice-${suffix}@example.test`,
        displayName: "Alice",
      });
      userIds.push(alice.id);
      const bob = await syncVerifiedUser({
        subject: `test-bob-${suffix}`,
        email: `bob-${suffix}@example.test`,
        displayName: "Bob",
      });
      userIds.push(bob.id);
      const carol = await syncVerifiedUser({
        subject: `test-carol-${suffix}`,
        email: `carol-${suffix}@example.test`,
        displayName: "Carol",
      });
      userIds.push(carol.id);

      const home = await createHome(alice, "The Sunday home");
      homeId = home.id;
      expect(home.members.map((member) => member.id)).toEqual([alice.id]);
      expect(home.boardId).toBeTruthy();
      await expect(getHome(carol, home.id)).rejects.toMatchObject({
        status: 404,
      });

      const withBob = await inviteMember(
        alice,
        home.id,
        bob.email.toUpperCase(),
      );
      expect(withBob.members.map((member) => member.id)).toContain(bob.id);
      expect((await listHomes(bob)).map((item) => item.id)).toContain(home.id);
      await expect(
        inviteMember(bob, home.id, carol.email),
      ).rejects.toMatchObject({ status: 403 });
      await expect(renameHome(bob, home.id, "Mine")).rejects.toMatchObject({
        status: 403,
      });

      const waitingEmail = `new-${suffix}@example.test`;
      const waiting = await inviteMember(alice, home.id, waitingEmail);
      expect(waiting.pendingInvitations.map((item) => item.email)).toEqual([
        waitingEmail,
      ]);
      const firstSignIn = await syncVerifiedUser({
        subject: `test-new-${suffix}`,
        email: waitingEmail.toUpperCase(),
        displayName: null,
      });
      userIds.push(firstSignIn.id);
      expect((await getHome(firstSignIn, home.id)).role).toBe("member");
      expect((await getHome(alice, home.id)).pendingInvitations).toHaveLength(
        0,
      );

      await expect(leaveHome(alice, home.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        removeMember(alice, home.id, alice.id),
      ).rejects.toMatchObject({ status: 403 });
      await leaveHome(bob, home.id);
      await expect(getHome(bob, home.id)).rejects.toMatchObject({
        status: 404,
      });
      await removeMember(alice, home.id, firstSignIn.id);
      await expect(getHome(firstSignIn, home.id)).rejects.toMatchObject({
        status: 404,
      });
      expect((await renameHome(alice, home.id, "The Kitchen")).name).toBe(
        "The Kitchen",
      );
    } finally {
      if (homeId) await database.delete(homes).where(eq(homes.id, homeId));
      if (userIds.length)
        await database.delete(users).where(inArray(users.id, userIds));
    }
  },
);
