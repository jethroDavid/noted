import { useState, type FormEvent } from "react";
import { useHomes } from "../use-homes";
import { Icon } from "../../../ui/icons";
import { HomeDialog } from "./home-dialog";

export function CreateHomeDialog({ onClose }: { onClose: () => void }) {
  const { busy, error, createHome } = useHomes();
  const [name, setName] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    const saved = await createHome(name.trim());
    if (saved) onClose();
  }

  return (
    <HomeDialog
      title="Give your home a name."
      eyebrow="A fresh start"
      busy={busy}
      error={error}
      onClose={onClose}
    >
      <p className="home-dialog-intro">
        A board for your notes, photos, and little hellos. You can invite your
        people once you&apos;re inside.
      </p>
      <form className="home-form" onSubmit={handleSubmit}>
        <label htmlFor="new-home-name">Home name</label>
        <input
          id="new-home-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          placeholder="The Sunday home"
          disabled={busy}
        />
        <p className="field-hint">
          Something that feels like you. You can change it later.
        </p>
        <footer className="modal-footer">
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary-button" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create home"}
            <Icon name="arrow" size={17} />
          </button>
        </footer>
      </form>
    </HomeDialog>
  );
}
