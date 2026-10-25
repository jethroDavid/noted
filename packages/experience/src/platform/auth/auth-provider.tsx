"use client";

import type { User } from "firebase/auth";
import { createContext, useContext } from "react";

export type AuthState =
  | { status: "unconfigured" | "loading" | "signed-out"; user: null }
  | { status: "signed-in"; user: User };
export type AuthContextValue = AuthState & {
  error: string | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
};
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("Missing authentication provider.");
  return value;
}
