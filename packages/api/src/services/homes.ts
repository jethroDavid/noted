import {
  boards,
  db,
  homeInvitations,
  homeMemberships,
  homes,
  users,
} from "@noted/db/src";
import type {
  Home,
  HomeDetail,
  Invitation,
  Member,
} from "@noted/validators/src";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { CurrentUser } from "./identity";
import { normalizeEmail } from "./identity";
import { boardChanged } from "./posts";

interface HomeRow {
  id: string;
  name: string;
  boardId: string;
  creatorUserId: string;
}

function toHome(user: CurrentUser, row: HomeRow): Home {
  return {
    id: row.id,
    name: row.name,
    boardId: row.boardId,
    creatorUserId: row.creatorUserId,
    role: row.creatorUserId === user.id ? "creator" : "member",
  };
}

function toMember(row: {
  id: string;
  email: string;
  displayName: string | null;
  creatorUserId: string;
}): Member {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    isCreator: row.id === row.creatorUserId,
  };
}

function toInvitation(row: {
  id: string;
  targetEmail: string;
  createdAt: Date;
}): Invitation {
  return { id: row.id, email: row.targetEmail, createdAt: row.createdAt };
}

async function findMemberHome(
  userId: string,
  homeId: string,
): Promise<HomeRow | undefined> {
  const [row] = await db
    .select({
      id: homes.id,
      name: homes.name,
      boardId: boards.id,
      creatorUserId: homes.creatorUserId,
    })
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .where(and(eq(homeMemberships.userId, userId), eq(homes.id, homeId)))
    .limit(1);
  return row;
}

async function requireMemberHome(
  user: CurrentUser,
  homeId: string,
): Promise<HomeRow> {
  const row = await findMemberHome(user.id, homeId);
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "Home not found." });
  return row;
}

async function requireCreatorHome(
  user: CurrentUser,
  homeId: string,
): Promise<HomeRow> {
  const row = await requireMemberHome(user, homeId);
  if (row.creatorUserId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the home creator can do this.",
    });
  }
  return row;
}

export async function listHomes(user: CurrentUser): Promise<Home[]> {
  const rows = await db
    .select({
      id: homes.id,
      name: homes.name,
      boardId: boards.id,
      creatorUserId: homes.creatorUserId,
      createdAt: homes.createdAt,
    })
    .from(homeMemberships)
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .innerJoin(boards, eq(boards.homeId, homes.id))
    .where(eq(homeMemberships.userId, user.id))
    .orderBy(asc(homes.createdAt));
  return rows.map((row) => toHome(user, row));
}

export async function createHome(
  user: CurrentUser,
  input: { name: string },
): Promise<Home> {
  return db.transaction(async (transaction) => {
    const [home] = await transaction
      .insert(homes)
      .values({ name: input.name, creatorUserId: user.id })
      .returning();
    if (!home) throw new Error("Home insert returned no row.");
    await transaction
      .insert(homeMemberships)
      .values({ homeId: home.id, userId: user.id });
    const [board] = await transaction
      .insert(boards)
      .values({ homeId: home.id, kind: "fridge" })
      .returning();
    if (!board) throw new Error("Board insert returned no row.");
    return toHome(user, {
      id: home.id,
      name: home.name,
      boardId: board.id,
      creatorUserId: home.creatorUserId,
    });
  });
}

export async function getHomeDetail(
  user: CurrentUser,
  homeId: string,
): Promise<HomeDetail> {
  const home = await requireMemberHome(user, homeId);
  const memberRows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      creatorUserId: homes.creatorUserId,
    })
    .from(homeMemberships)
    .innerJoin(users, eq(homeMemberships.userId, users.id))
    .innerJoin(homes, eq(homeMemberships.homeId, homes.id))
    .where(eq(homeMemberships.homeId, homeId))
    .orderBy(asc(homeMemberships.joinedAt));
  const invitationRows = await db
    .select({
      id: homeInvitations.id,
      targetEmail: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
    })
    .from(homeInvitations)
    .where(
      and(
        eq(homeInvitations.homeId, homeId),
        isNull(homeInvitations.consumedAt),
        isNull(homeInvitations.revokedAt),
      ),
    )
    .orderBy(asc(homeInvitations.createdAt));
  return {
    ...toHome(user, home),
    members: memberRows.map(toMember),
    pendingInvitations: invitationRows.map(toInvitation),
  };
}

export async function renameHome(
  user: CurrentUser,
  homeId: string,
  input: { name: string },
): Promise<Home> {
  const home = await requireCreatorHome(user, homeId);
  const [renamed] = await db
    .update(homes)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(homes.id, home.id))
    .returning({ id: homes.id, name: homes.name });
  if (!renamed) throw new Error("Home rename returned no row.");
  return toHome(user, { ...home, name: renamed.name });
}

export async function inviteMember(
  user: CurrentUser,
  homeId: string,
  input: { email: string },
): Promise<Invitation> {
  const home = await requireCreatorHome(user, homeId);
  const email = normalizeEmail(input.email);
  const [existingMember] = await db
    .select({ id: users.id })
    .from(homeMemberships)
    .innerJoin(users, eq(homeMemberships.userId, users.id))
    .where(and(eq(homeMemberships.homeId, home.id), eq(users.email, email)))
    .limit(1);
  if (existingMember) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This person is already a member.",
    });
  }
  const [pending] = await db
    .select({
      id: homeInvitations.id,
      targetEmail: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
    })
    .from(homeInvitations)
    .where(
      and(
        eq(homeInvitations.homeId, home.id),
        eq(homeInvitations.targetEmail, email),
        isNull(homeInvitations.consumedAt),
        isNull(homeInvitations.revokedAt),
      ),
    )
    .limit(1);
  if (pending) return toInvitation(pending);
  const [invitation] = await db
    .insert(homeInvitations)
    .values({ homeId: home.id, targetEmail: email, inviterUserId: user.id })
    .returning({
      id: homeInvitations.id,
      targetEmail: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
    });
  if (!invitation) throw new Error("Invitation insert returned no row.");
  return toInvitation(invitation);
}

export async function revokeInvitation(
  user: CurrentUser,
  homeId: string,
  input: { invitationId: string },
): Promise<Invitation> {
  const home = await requireCreatorHome(user, homeId);
  const [invitation] = await db
    .select({
      id: homeInvitations.id,
      targetEmail: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
      consumedAt: homeInvitations.consumedAt,
      revokedAt: homeInvitations.revokedAt,
    })
    .from(homeInvitations)
    .where(
      and(
        eq(homeInvitations.id, input.invitationId),
        eq(homeInvitations.homeId, home.id),
      ),
    )
    .limit(1);
  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found.",
    });
  }
  if (invitation.consumedAt) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This invitation was already accepted.",
    });
  }
  if (invitation.revokedAt) return toInvitation(invitation);
  const [revoked] = await db
    .update(homeInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(homeInvitations.id, invitation.id))
    .returning({
      id: homeInvitations.id,
      targetEmail: homeInvitations.targetEmail,
      createdAt: homeInvitations.createdAt,
    });
  if (!revoked) throw new Error("Invitation revoke returned no row.");
  return toInvitation(revoked);
}

export async function removeMember(
  user: CurrentUser,
  homeId: string,
  input: { userId: string },
): Promise<{ userId: string }> {
  const home = await requireCreatorHome(user, homeId);
  if (input.userId === home.creatorUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The creator cannot be removed.",
    });
  }
  const [removed] = await db
    .delete(homeMemberships)
    .where(
      and(
        eq(homeMemberships.homeId, home.id),
        eq(homeMemberships.userId, input.userId),
      ),
    )
    .returning({ userId: homeMemberships.userId });
  if (!removed) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
  }
  // Publish so the removed member's stream rechecks and ends at once.
  await boardChanged(home.boardId);
  return { userId: removed.userId };
}

export async function leaveHome(
  user: CurrentUser,
  homeId: string,
): Promise<{ homeId: string }> {
  const home = await requireMemberHome(user, homeId);
  if (home.creatorUserId === user.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The creator cannot leave the home.",
    });
  }
  await db
    .delete(homeMemberships)
    .where(
      and(
        eq(homeMemberships.homeId, home.id),
        eq(homeMemberships.userId, user.id),
      ),
    );
  // Publish so the leaver's stream (and everyone else's views) settle.
  await boardChanged(home.boardId);
  return { homeId: home.id };
}
