import type { HomesAuth } from "@noted/fridge-ui";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { authErrorMessage } from "./auth-error";
import { googleProvider, isFirebaseConfigured, webAuth } from "./firebase-auth";

function subscribe(
  onAccountChanged: (accountId: string | undefined) => void,
  onError: (cause: unknown) => void,
) {
  function handleUser(user: User | null) {
    onAccountChanged(user?.uid);
  }
  return onAuthStateChanged(webAuth(), handleUser, onError);
}

async function signIn() {
  await signInWithPopup(webAuth(), googleProvider);
}

function endSession() {
  return signOut(webAuth());
}

export const webAuthAdapter: HomesAuth = {
  isConfigured: isFirebaseConfigured,
  getAccountId: () => webAuth().currentUser?.uid,
  subscribe,
  signIn,
  signOut: endSession,
  errorMessage: authErrorMessage,
};
