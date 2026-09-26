import type { VerifiedIdentity } from "@noted/auth/src";
import { db, homeInvitations, homeMemberships, users } from "@noted/db/src";
import { and, eq, isNull, sql } from "drizzle-orm";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Upserts the verified Google user and claims pending email invitations.
// Runs on every authenticated request, as in v1.
export async function syncVerifiedUser(
  identity: VerifiedIdentity,
): Promise<CurrentUser> {
  const email = normalizeEmail(identity.email);
  return db.transaction(async (transaction) => {
    // Serializes first sign-in with an invitation to the same email.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`,
    );

    const [user] = await transaction
      .insert(users)
      .values({
        authSubject: identity.subject,
        email,
        displayName: identity.displayName,
      })
      .onConflictDoUpdate({
        target: users.authSubject,
        set: { email, displayName: identity.displayName },
      })
      .returning();
    if (!user) throw new Error("User upsert returned no row.");

    const invitations = await transaction
      .select({ id: homeInvitations.id, homeId: homeInvitations.homeId })
      .from(homeInvitations)
      .where(
        and(
          eq(homeInvitations.targetEmail, email),
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
