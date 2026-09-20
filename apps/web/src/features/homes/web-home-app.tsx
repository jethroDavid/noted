"use client";

import { HomePortal, HomesProvider } from "@noted/fridge-ui";
import { useRouter } from "next/navigation";
import { webFridgeAssets } from "@/features/fridge/assets";
import { homeApi } from "@/platform/api/home-api";
import { webAuthAdapter } from "@/platform/auth/web-auth-adapter";

export function WebHomeApp() {
  const router = useRouter();

  function openPlayground() {
    router.replace("/app");
  }

  return (
    <HomesProvider
      api={homeApi}
      auth={webAuthAdapter}
      onSignedOut={openPlayground}
    >
      <HomePortal assets={webFridgeAssets} playgroundHref="/app" />
    </HomesProvider>
  );
}
