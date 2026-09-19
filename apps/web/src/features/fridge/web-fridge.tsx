"use client";

import { FridgeApp, type FridgeAssets } from "@noted/fridge-ui";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  googleProvider,
  isFirebaseConfigured,
  webAuth,
} from "@/features/homes/firebase-auth";

const webAssets = {
  samplePhoto: {
    src: "/fixtures/lake.jpg",
    alt: "Mountains reflected in a turquoise lake",
  },
  sampleAudio: {
    src: "/fixtures/dinner.wav",
  },
} satisfies FridgeAssets;

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
        setError(cause.message);
        setAuthReady(true);
      },
    );
  }, []);

  async function openHomes() {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError(
        "Google sign-in needs Firebase setup before you can open a shared home.",
      );
      return;
    }
    setBusy(true);
    try {
      const auth = webAuth();
      if (!auth.currentUser) await signInWithPopup(auth, googleProvider);
      router.push("/app/homes");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Sign-in did not finish.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FridgeApp
      assets={webAssets}
      homeName="Playground"
      brandHref="/app"
      notice={error}
      headerAction={
        <button disabled={busy || !authReady} onClick={() => void openHomes()}>
          {signedIn ? "Your homes" : "Sign in"}
        </button>
      }
    />
  );
}
