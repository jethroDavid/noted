import type { NotedApiClient } from "@noted/api-client";
import type { FridgeAssets } from "../../../types";
import { useHomes } from "../use-homes";
import type { HomesAuth } from "../homes-auth";
import { HomeSwitcherView } from "./home-switcher-view";
import { HomeView } from "./home-view";

/** View for one open home route: loading, error, home, or welcome fallback. */
export function HomeRouteView({
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
  const { home, homeError, me, mode, retry, backToHomes } = useHomes();
  // Reset local dialogs when leaving a view or switching accounts.
  if (mode !== "ready") {
    return (
      <HomeSwitcherView
        key={me?.user.id ?? mode}
        playgroundHref={playgroundHref}
      />
    );
  }
  if (home) {
    return (
      <HomeView
        key={`${me?.user.id}:${home.id}`}
        assets={assets}
        playgroundHref={playgroundHref}
        api={api}
        auth={auth}
      />
    );
  }
  if (homeError) {
    return (
      <div className="noted-app portal-shell">
        <main className="portal-main">
          <p className="portal-error" role="alert">
            {homeError}
          </p>
          <div className="home-route-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => retry()}
            >
              Try again
            </button>
            <button
              type="button"
              className="secondary-button"
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
    <div className="noted-app portal-shell">
      <main className="portal-main">
        <div className="portal-loading" role="status">
          <span className="loading-dot" /> Opening your fridge…
        </div>
      </main>
    </div>
  );
}
