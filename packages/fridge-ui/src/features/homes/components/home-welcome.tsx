import { Icon } from "../../../ui/icons";
import { FridgePreview } from "./fridge-preview";

export type HomeWelcomeProps = {
  mode: "setup" | "signed-out" | "error";
  busy: boolean;
  playgroundHref: string;
  onSignIn: () => void;
  onRetry: () => void;
};

export function HomeWelcome({
  mode,
  busy,
  playgroundHref,
  onSignIn,
  onRetry,
}: HomeWelcomeProps) {
  let heading = "A place for your people.";
  if (mode === "error") {
    heading = "Your homes couldn't load.";
  } else if (mode === "setup") {
    heading = "The playground is open.";
  }

  let description =
    "Sign in to find your shared homes or start a new one. Your invitations will be waiting here.";
  if (mode === "error") {
    description = "You're signed in. Try reconnecting to your homes.";
  } else if (mode === "setup") {
    description =
      "Shared homes aren't available yet. You can still try the fridge in the playground.";
  }

  return (
    <section className="portal-welcome">
      <div className="portal-welcome-scene" aria-hidden="true">
        <FridgePreview />
        <span className="portal-welcome-caption">little things, together.</span>
      </div>
      <div className="portal-welcome-copy">
        <p className="eyebrow">
          {mode === "error" ? "Let's try again" : "Come on in"}
        </p>
        <h2>{heading}</h2>
        <p>{description}</p>
        {mode === "signed-out" && (
          <button className="primary-button" onClick={onSignIn} disabled={busy}>
            {busy ? "Signing in…" : "Continue with Google"}
            <Icon name="arrow" size={17} />
          </button>
        )}
        {mode === "error" && (
          <button className="primary-button" onClick={onRetry} disabled={busy}>
            Try again <Icon name="arrow" size={17} />
          </button>
        )}
        {mode === "setup" && (
          <a className="primary-button" href={playgroundHref}>
            Open playground <Icon name="arrow" size={17} />
          </a>
        )}
      </div>
    </section>
  );
}
