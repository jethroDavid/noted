import { useState, type FormEvent } from "react";
import { useHomes } from "../../use-homes";

export function RenameHomeForm({
  onFeedback,
}: {
  onFeedback: (message: string) => void;
}) {
  const { home, busy, renameHome } = useHomes();
  const [draft, setDraft] = useState(home?.name ?? "");
  if (!home) return null;
  const homeId = home.id;
  const unchanged = !draft.trim() || draft.trim() === home.name;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || unchanged) return;
    onFeedback("");
    const saved = await renameHome(homeId, draft.trim());
    if (saved) onFeedback("Home name updated.");
  }

  return (
    <form className="home-form home-settings-section" onSubmit={handleSubmit}>
      <label htmlFor="rename-home">Home name</label>
      <div className="home-input-action">
        <input
          id="rename-home"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={80}
          required
          disabled={busy}
        />
        <button className="primary-button" disabled={busy || unchanged}>
          Save
        </button>
      </div>
    </form>
  );
}
