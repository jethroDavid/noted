"use client";

import { createApiClient } from "@noted/api-client";
import type { HomeDetail, MeResponse } from "@noted/contracts";
import { HomePortal, type FridgeAssets } from "@noted/fridge-ui";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { googleProvider, isFirebaseConfigured, webAuth } from "./firebase-auth";

const assets = {
  samplePhoto: {
    src: "/fixtures/lake.jpg",
    alt: "Mountains reflected in a turquoise lake",
  },
  sampleAudio: { src: "/fixtures/dinner.wav" },
} satisfies FridgeAssets;

export function WebHomeApp() {
  const router = useRouter();
  const [mode, setMode] = useState<
    "loading" | "setup" | "signed-out" | "ready"
  >(() => (isFirebaseConfigured() ? "loading" : "setup"));
  const [me, setMe] = useState<MeResponse | null>(null);
  const [home, setHome] = useState<HomeDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(
    () =>
      createApiClient({
        getIdToken: async () => {
          const user = webAuth().currentUser;
          if (!user) throw new Error("Sign in to continue.");
          return user.getIdToken();
        },
      }),
    [],
  );

  const reportError = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "Something went wrong.");
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(webAuth(), async (user) => {
      if (!user) {
        setMe(null);
        setHome(null);
        setMode("signed-out");
        return;
      }
      try {
        const result = await api.me();
        if (webAuth().currentUser?.uid !== user.uid) return;
        setMe(result);
        setMode("ready");
        setError(null);
      } catch (cause) {
        reportError(cause);
        setMode("signed-out");
      }
    });
  }, [api, reportError]);

  const currentHomeId = home?.id;
  useEffect(() => {
    if (mode !== "ready") return;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const result = await api.me();
        setMe(result);
        if (currentHomeId) {
          const detail = await api.home(currentHomeId);
          setHome(detail.home);
        }
      } catch (cause) {
        if (currentHomeId) {
          setHome(null);
          reportError(cause);
        }
      }
    };
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [api, currentHomeId, mode, reportError]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      reportError(cause);
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function selectHome(id: string) {
    try {
      setError(null);
      setHome((await api.home(id)).home);
    } catch (cause) {
      reportError(cause);
      setMe(await api.me().catch(() => me));
    }
  }

  return (
    <HomePortal
      assets={assets}
      playgroundHref="/app"
      mode={mode}
      me={me}
      home={home}
      busy={busy}
      error={error}
      onSignIn={() => {
        void run(async () => {
          await signInWithPopup(webAuth(), googleProvider);
        }).catch(() => {});
      }}
      onSignOut={() => {
        void signOut(webAuth())
          .then(() => router.replace("/app"))
          .catch(reportError);
      }}
      onSelectHome={(id) => {
        void selectHome(id);
      }}
      onBack={() => {
        setHome(null);
        setError(null);
      }}
      onCreateHome={(name) =>
        run(async () => {
          const result = await api.createHome(name);
          setMe(await api.me());
          setHome(result.home);
        })
      }
      onRenameHome={(name) =>
        run(async () => {
          if (!home) return;
          const result = await api.renameHome(home.id, name);
          setHome(result.home);
          setMe(await api.me());
        })
      }
      onInvite={(email) =>
        run(async () => {
          if (!home) return;
          setHome((await api.invite(home.id, email)).home);
        })
      }
      onRemoveMember={(memberId) =>
        run(async () => {
          if (!home) return;
          setHome((await api.removeMember(home.id, memberId)).home);
        })
      }
      onLeave={() =>
        run(async () => {
          if (!home) return;
          const result = await api.leaveHome(home.id);
          setHome(null);
          setMe((current) =>
            current ? { ...current, homes: result.homes } : current,
          );
        })
      }
    />
  );
}
