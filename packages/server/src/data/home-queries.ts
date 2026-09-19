import { and, desc, eq, isNull, sql } from "drizzle-orm";

import {
  database,
  boards,
  homeInvitations,
  homeMemberships,
  homes,
  users,
} from "@noted/database";

const homeColumns = {
  id: homes.id,
  name: homes.name,
  creatorUserId: homes.creatorUserId,
  boardId: boards.id,
};

export async function findHomesForUser(userId: string) {
  return database
    .select(homeColumns)
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .where(eq(homeMemberships.userId, userId))
    .orderBy(desc(homes.updatedAt));
}

export async function findHomeForMember(userId: string, homeId: string) {
  const [row] = await database
    .select(homeColumns)
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .where(and(eq(homeMemberships.userId, userId), eq(homes.id, homeId)))
    .limit(1);
  return row;
}

export async function findHomeMembers(homeId: string) {
  return database
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(homeMemberships)
    .innerJoin(users, eq(homeMemberships.userId, users.id))
    .where(eq(homeMemberships.homeId, homeId))
    .orderBy(homeMemberships.joinedAt);
}

export async function findPendingInvitations(homeId: string) {
  return database
    .select({
      id: homeInvitations.id,
      email: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
    })
    .from(homeInvitations)
    .where(
      and(
        eq(homeInvitations.homeId, homeId),
        isNull(homeInvitations.consumedAt),
        isNull(homeInvitations.revokedAt),
      ),
    );
}

export async function insertHomeWithBoard(creatorUserId: string, name: string) {
  return database.transaction(async (transaction) => {
    const [home] = await transaction
      .insert(homes)
      .values({ name, creatorUserId })
      .returning({ id: homes.id });
    await transaction.insert(homeMemberships).values({
      homeId: home.id,
      userId: creatorUserId,
    });
    await transaction
      .insert(boards)
      .values({ homeId: home.id, kind: "fridge" });
    return home.id;
  });
}

export async function updateHomeName(
  creatorUserId: string,
  homeId: string,
  name: string,
) {
  await database
    .update(homes)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(homes.id, homeId), eq(homes.creatorUserId, creatorUserId)));
}

export async function inviteEmailToHome(
  inviterUserId: string,
  homeId: string,
  email: string,
) {
  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`,
    );
    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      const [member] = await transaction
        .select({ userId: homeMemberships.userId })
        .from(homeMemberships)
        .where(
          and(
            eq(homeMemberships.homeId, homeId),
            eq(homeMemberships.userId, existingUser.id),
          ),
        )
        .limit(1);
      if (member) return;
    }

    const [pending] = await transaction
      .select({ id: homeInvitations.id })
      .from(homeInvitations)
      .where(
        and(
          eq(homeInvitations.homeId, homeId),
          eq(homeInvitations.targetEmail, email),
          isNull(homeInvitations.consumedAt),
          isNull(homeInvitations.revokedAt),
        ),
      )
      .limit(1);
    if (pending) return;

    await transaction.insert(homeInvitations).values({
      homeId,
      targetEmail: email,
      inviterUserId,
      consumedAt: existingUser ? new Date() : null,
    });
    if (existingUser) {
      await transaction
        .insert(homeMemberships)
        .values({ homeId, userId: existingUser.id })
        .onConflictDoNothing();
    }
  });
}

export async function deleteMemberFromHome(homeId: string, memberId: string) {
  return database.transaction(async (transaction) => {
    const [member] = await transaction
      .select({ email: users.email })
      .from(homeMemberships)
      .innerJoin(users, eq(homeMemberships.userId, users.id))
      .where(
        and(
          eq(homeMemberships.homeId, homeId),
          eq(homeMemberships.userId, memberId),
        ),
      )
      .limit(1);
    if (!member) return false;
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${member.email}, 0))`,
    );
    await transaction
      .delete(homeMemberships)
      .where(
        and(
          eq(homeMemberships.homeId, homeId),
          eq(homeMemberships.userId, memberId),
        ),
      );
    await transaction
      .update(homeInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(homeInvitations.homeId, homeId),
          eq(homeInvitations.targetEmail, member.email),
          isNull(homeInvitations.consumedAt),
          isNull(homeInvitations.revokedAt),
        ),
      );
    return true;
  });
}

export async function deleteOwnMembership(homeId: string, userId: string) {
  await database
    .delete(homeMemberships)
    .where(
      and(
        eq(homeMemberships.homeId, homeId),
        eq(homeMemberships.userId, userId),
      ),
    );
}
