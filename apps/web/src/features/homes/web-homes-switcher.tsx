"use client";

import { HomeSwitcherView, useHomes } from "@noted/fridge-ui";

export function WebHomesSwitcher() {
  const { me, mode } = useHomes();
  // Reset local dialogs when leaving a view or switching accounts.
  return <HomeSwitcherView key={me?.user.id ?? mode} playgroundHref="/app" />;
}
