/** A small, local illustration that echoes the full fridge scene. */
export function FridgePreview({ tone = 0 }: { tone?: number }) {
  return (
    <span className={`home-fridge home-fridge--${tone % 3}`} aria-hidden="true">
      <span className="home-fridge-top">
        <i />
      </span>
      <span className="home-fridge-door">
        <i />
        <span className="home-fridge-note">
          hello<span>♡</span>
        </span>
        <span className="home-fridge-photo" />
      </span>
    </span>
  );
}
