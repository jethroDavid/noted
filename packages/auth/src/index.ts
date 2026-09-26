import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env";

export { env } from "./env";
export type { ServerEnv } from "./env.js";

export interface ServerUser {
  uid: string;
  email?: string;
}

function adminAuth() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      env().FIREBASE_SERVICE_ACCOUNT_KEY_INLINE,
    ) as {
      projectId?: string;
      privateKey?: string;
      clientEmail?: string;
    };
    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        privateKey: serviceAccount.privateKey,
        clientEmail: serviceAccount.clientEmail,
      }),
    });
  }
  return getAuth();
}

// Small server seam: Phase 1 calls this from tRPC context to turn a client
// ID token into a verified user. The client sign-in flow lands with the web app.
export async function getServerUser(
  idToken: string,
): Promise<ServerUser | null> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
