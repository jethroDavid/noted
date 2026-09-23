/** A small, local illustration that echoes the full board scene. */
export function BoardPreview({ tone = 0 }: { tone?: number }) {
  return (
    <span className={`home-board home-board--${tone % 3}`} aria-hidden="true">
      <span className="home-board-top">
        <i />
      </span>
      <span className="home-board-door">
        <i />
        <span className="home-board-note">
          hello<span>♡</span>
        </span>
        <span className="home-board-photo" />
      </span>
    </span>
  );
}
