"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  signOut as firebaseSignOut,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isNativeShell } from "../device";
import {
  googleProvider,
  isFirebaseConfigured,
  webAuth,
} from "./firebase-client";

export type AuthState =
  | { status: "unconfigured"; user: null }
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: User };

export type AuthContextValue = AuthState & {
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthState>(() =>
    isFirebaseConfigured()
      ? { status: "loading", user: null }
      : { status: "unconfigured", user: null },
  );
  const [error, setError] = useState<string | null>(null);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(webAuth(), (user) => {
      // Account switches must not leak the previous account's cached data.
      if (lastUid.current !== user?.uid) {
        lastUid.current = user?.uid ?? null;
        void queryClient.clear();
      }
      setAuth(
        user
          ? { status: "signed-in", user }
          : { status: "signed-out", user: null },
      );
    });
  }, [queryClient]);

  // Surfaces redirect-flow failures on return; a no-op when the page was
  // not reached via signInWithRedirect. Success flows through the auth
  // state listener above like any other sign-in.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    void getRedirectResult(webAuth()).catch(() => {
      setError(
        "Google sign-in failed. Check the NEXT_PUBLIC_FIREBASE_* values in .env.",
      );
    });
  }, []);

  async function signIn() {
    setError(null);
    try {
      if (isNativeShell()) {
        await signInWithRedirect(webAuth(), googleProvider);
      } else {
        await signInWithPopup(webAuth(), googleProvider);
      }
    } catch {
      setError(
        "Google sign-in failed. Check the NEXT_PUBLIC_FIREBASE_* values in .env.",
      );
    }
  }

  async function signOut() {
    setError(null);
    try {
      await firebaseSignOut(webAuth());
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  }

  return (
    <AuthContext.Provider value={{ ...auth, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
