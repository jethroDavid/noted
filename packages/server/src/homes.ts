import type { Home, HomeDetail } from "@noted/contracts";

import {
  deleteMemberFromHome,
  deleteOwnMembership,
  findHomeForMember,
  findHomeMembers,
  findHomesForUser,
  findPendingInvitations,
  insertHomeWithBoard,
  inviteEmailToHome,
  updateHomeName,
} from "./data/home-queries";
import { ServiceError } from "./errors";
import { normalizeEmail, type CurrentUser } from "./identity";

export async function listHomes(user: CurrentUser): Promise<Home[]> {
  const rows = await findHomesForUser(user.id);

  return rows.map((row) => ({
    ...row,
    role: row.creatorUserId === user.id ? "creator" : "member",
  }));
}

export async function getHome(
  user: CurrentUser,
  homeId: string,
): Promise<HomeDetail> {
  const row = await findHomeForMember(user.id, homeId);
  if (!row) throw new ServiceError(404, "Home not found.");

  const members = await findHomeMembers(homeId);

  const invitations =
    row.creatorUserId === user.id ? await findPendingInvitations(homeId) : [];

  return {
    ...row,
    role: row.creatorUserId === user.id ? "creator" : "member",
    members: members.map((member) => ({
      ...member,
      isCreator: member.id === row.creatorUserId,
    })),
    pendingInvitations: invitations.map((invite) => ({
      ...invite,
      createdAt: invite.createdAt.toISOString(),
    })),
  };
}

async function requireCreator(user: CurrentUser, homeId: string) {
  const home = await getHome(user, homeId);
  if (home.role !== "creator") {
    throw new ServiceError(403, "Only the home creator can do that.");
  }
  return home;
}

export async function createHome(user: CurrentUser, name: string) {
  const homeId = await insertHomeWithBoard(user.id, name);
  return getHome(user, homeId);
}

export async function renameHome(
  user: CurrentUser,
  homeId: string,
  name: string,
) {
  await requireCreator(user, homeId);
  await updateHomeName(user.id, homeId, name);
  return getHome(user, homeId);
}

export async function inviteMember(
  user: CurrentUser,
  homeId: string,
  targetEmail: string,
) {
  await requireCreator(user, homeId);
  const email = normalizeEmail(targetEmail);
  await inviteEmailToHome(user.id, homeId, email);
  return getHome(user, homeId);
}

export async function removeMember(
  user: CurrentUser,
  homeId: string,
  memberId: string,
) {
  const home = await requireCreator(user, homeId);
  if (memberId === home.creatorUserId) {
    throw new ServiceError(403, "The home creator cannot be removed.");
  }
  const removed = await deleteMemberFromHome(homeId, memberId);
  if (!removed) throw new ServiceError(404, "Member not found.");
  return getHome(user, homeId);
}

export async function leaveHome(user: CurrentUser, homeId: string) {
  const home = await getHome(user, homeId);
  if (home.role === "creator") {
    throw new ServiceError(403, "The home creator cannot leave.");
  }
  await deleteOwnMembership(homeId, user.id);
  return listHomes(user);
}
