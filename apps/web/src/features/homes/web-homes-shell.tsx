"use client";

import { HomesProvider } from "@noted/fridge-ui";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { homeApi } from "@/platform/api/home-api";
import { webAuthAdapter } from "@/platform/auth/web-auth-adapter";

export function WebHomesShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const rawId = params.homeId;
  const homeId = typeof rawId === "string" ? rawId : null;

  function openHome(id: string) {
    router.push(`/app/homes/${id}`);
  }

  function backToHomes() {
    router.push("/app/homes");
  }

  function signedOut() {
    router.replace("/app");
  }

  return (
    <HomesProvider
      api={homeApi}
      auth={webAuthAdapter}
      homeId={homeId}
      onOpenHome={openHome}
      onBackToHomes={backToHomes}
      onSignedOut={signedOut}
    >
      {children}
    </HomesProvider>
  );
}
