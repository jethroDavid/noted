import { and, eq, isNull, sql } from "drizzle-orm";

import {
  database,
  homeInvitations,
  homeMemberships,
  users,
} from "@noted/database";

export async function upsertUserAndClaimInvitations(identity: {
  subject: string;
  email: string;
  displayName: string | null;
}) {
  return database.transaction(async (transaction) => {
    // Serializes first sign-in with an invitation to the same email.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${identity.email}, 0))`,
    );

    const [user] = await transaction
      .insert(users)
      .values({
        authSubject: identity.subject,
        email: identity.email,
        displayName: identity.displayName,
      })
      .onConflictDoUpdate({
        target: users.authSubject,
        set: { email: identity.email, displayName: identity.displayName },
      })
      .returning();

    const invitations = await transaction
      .select({ id: homeInvitations.id, homeId: homeInvitations.homeId })
      .from(homeInvitations)
      .where(
        and(
          eq(homeInvitations.targetEmail, identity.email),
          isNull(homeInvitations.consumedAt),
          isNull(homeInvitations.revokedAt),
        ),
      );

    for (const invitation of invitations) {
      await transaction
        .insert(homeMemberships)
        .values({ homeId: invitation.homeId, userId: user.id })
        .onConflictDoNothing();
      await transaction
        .update(homeInvitations)
        .set({ consumedAt: new Date() })
        .where(eq(homeInvitations.id, invitation.id));
    }

    return { id: user.id, email: user.email, displayName: user.displayName };
  });
}
