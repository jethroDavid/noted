import { useState } from "react";
import { INK_COLORS, PAPER_COLORS } from "../../state/board";
import type { PostModalProps } from "../post-modal";
import { PostModalFrame } from "./post-modal-frame";

export function TextPostModal(props: PostModalProps) {
  const [draft, setDraft] = useState(props.post);
  const pending = props.post.removedAt !== null;
  return (
    <PostModalFrame
      {...props}
      title={props.isNew ? "Add a note" : "Edit your note"}
      saveLabel={props.isNew ? "Put on fridge" : "Save note"}
      saveDisabled={!draft.text.trim()}
      onSubmit={() => props.onSave({ ...draft, text: draft.text.trim() })}
    >
      <label className="field-label" htmlFor="note-text">
        Your message
      </label>
      <textarea
        id="note-text"
        className="note-editor"
        value={draft.text}
        maxLength={2000}
        required
        disabled={pending}
        placeholder="Leave a little something…"
        style={{
          backgroundColor: draft.background,
          color: draft.foreground,
        }}
        onChange={(event) => setDraft({ ...draft, text: event.target.value })}
      />
      <div className="character-count">{draft.text.length} / 2,000</div>
      {!pending && (
        <div className="palette-row">
          <fieldset>
            <legend>Paper</legend>
            <div className="swatches">
              {PAPER_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="swatch"
                  aria-label={`${color.name} paper`}
                  aria-pressed={draft.background === color.value}
                  style={{ backgroundColor: color.value }}
                  onClick={() =>
                    setDraft({ ...draft, background: color.value })
                  }
                >
                  {draft.background === color.value ? "✓" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ink</legend>
            <div className="swatches">
              {INK_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="swatch swatch--ink"
                  aria-label={`${color.name} ink`}
                  aria-pressed={draft.foreground === color.value}
                  style={{ backgroundColor: color.value }}
                  onClick={() =>
                    setDraft({ ...draft, foreground: color.value })
                  }
                >
                  {draft.foreground === color.value ? "✓" : ""}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </PostModalFrame>
  );
}
