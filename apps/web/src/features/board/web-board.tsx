"use client";

import { FridgeApp } from "@noted/fridge-ui";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  googleProvider,
  isFirebaseConfigured,
  webAuth,
} from "../../platform/auth/firebase-auth";
import { authErrorMessage } from "../../platform/auth/auth-error";
import { webFridgeAssets } from "./assets";

export function WebFridge() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(
      webAuth(),
      (user) => {
        setSignedIn(Boolean(user));
        setAuthReady(true);
      },
      (cause) => {
        setError(authErrorMessage(cause));
        setAuthReady(true);
      },
    );
  }, []);

  async function openHomes() {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError(
        "Shared homes aren't available yet. You can still try the playground.",
      );
      return;
    }
    setBusy(true);
    try {
      const auth = webAuth();
      if (!auth.currentUser) await signInWithPopup(auth, googleProvider);
      router.push("/app/homes");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  let headerLabel = "Sign in";
  if (busy) {
    headerLabel = "Opening…";
  } else if (signedIn) {
    headerLabel = "Your homes";
  }

  return (
    <FridgeApp
      assets={webFridgeAssets}
      homeName="Playground"
      brandHref="/app"
      notice={error}
      headerAction={
        <button
          className="primary-button primary-button--small"
          disabled={busy || !authReady}
          onClick={() => void openHomes()}
        >
          {headerLabel}
        </button>
      }
    />
  );
}
