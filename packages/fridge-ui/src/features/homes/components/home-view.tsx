import { useState } from "react";
import type { NotedApiClient } from "@noted/api-client";
import {
  FridgeApp,
  FridgePostsProvider,
  useFridgePosts,
  useFridgePostsSource,
} from "../../fridge";
import type { FridgeAssets } from "../../../types";
import { useHomes } from "../use-homes";
import type { HomesAuth } from "../homes-auth";
import { HomeSettingsDialog } from "./settings/home-settings-dialog";

export function HomeView({
  assets,
  playgroundHref,
  api,
  auth,
}: {
  assets: FridgeAssets;
  playgroundHref: string;
  api: NotedApiClient;
  auth: HomesAuth;
}) {
  const { home } = useHomes();
  if (!home) return null;

  return (
    <FridgePostsProvider
      api={api}
      auth={auth}
      homeId={home.id}
      boardId={home.boardId}
    >
      <HomeFridge assets={assets} playgroundHref={playgroundHref} />
    </FridgePostsProvider>
  );
}

function HomeFridge({
  assets,
  playgroundHref,
}: {
  assets: FridgeAssets;
  playgroundHref: string;
}) {
  const { home, busy, error, backToHomes } = useHomes();
  const { accessLost } = useFridgePosts();
  const source = useFridgePostsSource();
  const [showPeople, setShowPeople] = useState(false);
  if (!home) return null;

  if (accessLost) {
    return (
      <div className="noted-app app-shell">
        <main className="kitchen">
          <div className="fridge-status" role="alert">
            <p>You no longer have access to this home.</p>
            <button
              type="button"
              className="primary-button"
              onClick={backToHomes}
            >
              Back to homes
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <FridgeApp
      assets={assets}
      homeName={home.name}
      isPlayground={false}
      brandHref={playgroundHref}
      source={source}
      availableKinds={["text"]}
      notice={showPeople ? null : (source.error ?? error)}
      headerAction={
        <>
          <button
            className="secondary-button"
            onClick={backToHomes}
            disabled={busy}
          >
            Homes
          </button>
          <button
            className="secondary-button"
            onClick={() => setShowPeople(true)}
            aria-haspopup="dialog"
          >
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
