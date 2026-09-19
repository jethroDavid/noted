import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { upsertUserAndClaimInvitations } from "./data/identity-queries";
import { ServiceError } from "./errors";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function adminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new ServiceError(503, "Google sign-in has not been configured yet.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      projectId,
      credential: applicationDefault(),
    });

  return getAuth(app);
}

export async function verifyIdentity(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new ServiceError(401, "Sign in to continue.");
  }

  try {
    const token = await adminAuth().verifyIdToken(authorization.slice(7), true);

    if (
      !token.email ||
      token.email_verified !== true ||
      token.firebase.sign_in_provider !== "google.com"
    ) {
      throw new ServiceError(403, "A verified Google account is required.");
    }

    return {
      subject: token.uid,
      email: normalizeEmail(token.email),
      displayName: typeof token.name === "string" ? token.name : null,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(401, "Your sign-in expired. Please sign in again.");
  }
}

export async function requireUser(request: Request) {
  const identity = await verifyIdentity(request);

  return syncVerifiedUser(identity);
}

export async function syncVerifiedUser(identity: {
  subject: string;
  email: string;
  displayName: string | null;
}) {
  return upsertUserAndClaimInvitations({
    ...identity,
    email: normalizeEmail(identity.email),
  });
}

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
