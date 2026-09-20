import { useState } from "react";
import { FridgeApp } from "../../fridge";
import type { FridgeAssets } from "../../../types";
import { useHomes } from "../use-homes";
import { HomeSettingsDialog } from "./settings/home-settings-dialog";

export function HomeView({
  assets,
  playgroundHref,
}: {
  assets: FridgeAssets;
  playgroundHref: string;
}) {
  const { home, busy, error, backToHomes } = useHomes();
  const [showPeople, setShowPeople] = useState(false);
  if (!home) return null;

  return (
    <FridgeApp
      assets={assets}
      homeName={home.name}
      isPlayground={false}
      brandHref={playgroundHref}
      notice={showPeople ? null : error}
      headerAction={
        <>
          <button onClick={backToHomes} disabled={busy}>
            Homes
          </button>
          <button onClick={() => setShowPeople(true)} aria-haspopup="dialog">
            People
          </button>
        </>
      }
      overlay={
        showPeople && (
          <HomeSettingsDialog onClose={() => setShowPeople(false)} />
        )
      }
    />
  );
}
