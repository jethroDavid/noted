import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env";

export { env } from "./env";
export type { ServerEnv } from "./env.js";

export interface VerifiedIdentity {
  subject: string;
  email: string;
  displayName: string | null;
}

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function adminAuth() {
  try {
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(
        env().FIREBASE_SERVICE_ACCOUNT_KEY_INLINE,
      ) as {
        project_id?: string;
        private_key?: string;
        client_email?: string;
      };
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          privateKey: serviceAccount.private_key,
          clientEmail: serviceAccount.client_email,
        }),
      });
    }
    return getAuth();
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    throw new AuthError(
      "UNAVAILABLE",
      "Google sign-in has not been configured yet.",
    );
  }
}

// Small server seam: tRPC context calls this to turn a client ID token into a
// verified Google identity. Only verified google.com sign-ins pass.
export async function verifyIdToken(
  idToken: string,
): Promise<VerifiedIdentity> {
  let decoded: Awaited<
    ReturnType<ReturnType<typeof adminAuth>["verifyIdToken"]>
  >;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, true);
  } catch (error) {
    if (error instanceof AuthError) throw error;

    throw new AuthError(
      "UNAUTHENTICATED",
      "Your sign-in expired. Please sign in again.",
    );
  }

  if (
    !decoded.email ||
    decoded.email_verified !== true ||
    decoded.firebase.sign_in_provider !== "google.com"
  ) {
    throw new AuthError("FORBIDDEN", "A verified Google account is required.");
  }

  return {
    subject: decoded.uid,
    email: decoded.email.trim().toLowerCase(),
    displayName: typeof decoded.name === "string" ? decoded.name : null,
  };
}
