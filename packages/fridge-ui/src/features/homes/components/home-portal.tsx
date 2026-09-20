"use client";

import type { FridgeAssets } from "../../../types";
import { useHomes } from "../use-homes";
import { HomeView } from "./home-view";
import { HomeSwitcherView } from "./home-switcher-view";

export function HomePortal({
  assets,
  playgroundHref,
}: {
  assets: FridgeAssets;
  playgroundHref: string;
}) {
  const { home, me, mode } = useHomes();
  // Reset local dialogs when leaving a view or switching accounts.
  return home ? (
    <HomeView
      key={`${me?.user.id}:${home.id}`}
      assets={assets}
      playgroundHref={playgroundHref}
    />
  ) : (
    <HomeSwitcherView
      key={me?.user.id ?? mode}
      playgroundHref={playgroundHref}
    />
  );
}
