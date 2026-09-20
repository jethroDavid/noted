import type { Home } from "@noted/contracts";
import { Icon } from "../../../ui/icons";
import { FridgePreview } from "./fridge-preview";

function homeCaption(home: Home, openingHomeId: string | null) {
  if (openingHomeId === home.id) return "Opening your fridge…";
  if (home.role === "creator") return "Created by you";
  return "Shared with you";
}

export function HomeGrid({
  homes,
  busy,
  openingHomeId,
  onSelectHome,
  onCreate,
}: {
  homes: Home[];
  busy: boolean;
  openingHomeId: string | null;
  onSelectHome: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="home-grid" aria-label="Your homes" aria-busy={busy}>
      {homes.map((home, index) => (
        <button
          className="home-choice"
          key={home.id}
          disabled={busy}
          onClick={() => onSelectHome(home.id)}
        >
          <span className={`home-choice-scene home-choice-scene--${index % 3}`}>
            <FridgePreview tone={index} />
          </span>
          <span className="home-choice-caption">
            <span>
              <strong>{home.name}</strong>
              <small>{homeCaption(home, openingHomeId)}</small>
            </span>
            <Icon name="arrow" size={19} />
          </span>
        </button>
      ))}
      <button className="home-create-choice" onClick={onCreate} disabled={busy}>
        <span className="home-create-icon">
          <Icon name="plus" size={25} />
        </span>
        <strong>Create a home</strong>
        <span>A fresh fridge for your people.</span>
      </button>
    </section>
  );
}
