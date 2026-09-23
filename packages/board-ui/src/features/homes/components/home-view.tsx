import { useState } from "react";
import type { NotedApiClient } from "@noted/api-client";
import {
  BoardApp,
  BoardPostsProvider,
  useBoardPosts,
  useBoardPostsSource,
} from "../../board";
import type { ThemeAssets } from "../../../types";
import { useHomes } from "../use-homes";
import type { HomesAuth } from "../homes-auth";
import { HomeSettingsDialog } from "./settings/home-settings-dialog";

export function HomeView({
  assets,
  playgroundHref,
  api,
  auth,
}: {
  assets: ThemeAssets;
  playgroundHref: string;
  api: NotedApiClient;
  auth: HomesAuth;
}) {
  const { home } = useHomes();
  if (!home) return null;

  return (
    <BoardPostsProvider
      api={api}
      auth={auth}
      homeId={home.id}
      boardId={home.boardId}
    >
      <HomeBoard assets={assets} playgroundHref={playgroundHref} />
    </BoardPostsProvider>
  );
}

function HomeBoard({
  assets,
  playgroundHref,
}: {
  assets: ThemeAssets;
  playgroundHref: string;
}) {
  const { home, busy, error, backToHomes } = useHomes();
  const { accessLost } = useBoardPosts();
  const source = useBoardPostsSource();
  const [showPeople, setShowPeople] = useState(false);
  if (!home) return null;

  if (accessLost) {
    return (
      <div className="noted-app app-shell">
        <main className="scene">
          <div className="board-status" role="alert">
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
    <BoardApp
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
