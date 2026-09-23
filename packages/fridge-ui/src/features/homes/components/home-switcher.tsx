import { BrandLink } from "../../../ui/brand-link";
import { Icon } from "../../../ui/icons";
import { useHomes } from "../use-homes";
import { HomeGrid } from "./home-grid";
import { HomeWelcome } from "./home-welcome";

export function HomeSwitcher({
  playgroundHref,
  onCreate,
  hideError = false,
}: {
  playgroundHref: string;
  onCreate: () => void;
  hideError?: boolean;
}) {
  const { mode, me, busy, error, selectHome, signIn, signOut, retry } = useHomes();
  const ready = mode === "ready" && me;
  const displayName = me?.user.displayName || me?.user.email;

  return (
    <div className="noted-app portal-shell">
      <header className="portal-header">
        <BrandLink href={playgroundHref} />
        <nav aria-label="Account navigation">
          {me && (
            <>
              <span className="portal-account" title={displayName}>
                <span className="person-avatar" aria-hidden="true">
                  {displayName?.slice(0, 1).toUpperCase()}
                </span>
                <span>{displayName}</span>
              </span>
              <button className="text-button" disabled={busy} onClick={signOut}>
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="portal-main">
        <div className="portal-title-row">
          <div>
            <p className="eyebrow">A little space for your people</p>
            <h1>
              Your homes<span>.</span>
            </h1>
            <p className="portal-description">
              {ready
                ? "Choose a fridge. Leave a little something."
                : "Your people, and a fridge to share."}
            </p>
          </div>
          {ready && (
            <span className="portal-handwritten" aria-hidden="true">
              Make yourself at home.
            </span>
          )}
        </div>
        {!hideError && error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}
        {mode === "loading" && (
          <div className="portal-loading" role="status">
            <span className="loading-dot" /> Getting your homes ready…
          </div>
        )}
        {ready ? (
          <>
            {ready.homes.length === 0 && (
              <p className="portal-empty">
                Your first home starts here. Homes shared with you will appear
                here too.
              </p>
            )}
            <HomeGrid
              homes={ready.homes}
              busy={busy}
              onSelectHome={selectHome}
              onCreate={onCreate}
            />
            <aside className="playground-invitation">
              <span className="playground-note" aria-hidden="true">
                <Icon name="note" size={24} />
              </span>
              <div>
                <strong>Just having a look?</strong>
                <p>The playground is yours to try. Nothing there is saved.</p>
              </div>
              <a href={playgroundHref}>
                Open playground <Icon name="arrow" size={17} />
              </a>
            </aside>
          </>
        ) : (
          mode !== "loading" && (
            <HomeWelcome
              mode={mode === "ready" ? "error" : mode}
              busy={busy}
              playgroundHref={playgroundHref}
              onSignIn={signIn}
              onRetry={retry}
            />
          )
        )}
      </main>
      <footer className="portal-footer">
        <span>noted · the little things, together</span>
        <span>Notes. Photos. Little hellos.</span>
      </footer>
    </div>
  );
}
