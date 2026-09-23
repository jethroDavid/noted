"use client";

import { HomeRouteView } from "@noted/fridge-ui";
import { webFridgeAssets } from "@/features/fridge/assets";
import { homeApi } from "@/platform/api/home-api";
import { webAuthAdapter } from "@/platform/auth/web-auth-adapter";

export function WebOpenHome() {
  return (
    <HomeRouteView
      assets={webFridgeAssets}
      playgroundHref="/app"
      api={homeApi}
      auth={webAuthAdapter}
    />
  );
}
