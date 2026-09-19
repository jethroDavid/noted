import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { FRIDGE_MODELS, FRIDGE_MODEL_IDS, type FridgeModelId } from "./models";

export function ModelPicker({
  value,
  onChange,
}: {
  value: FridgeModelId;
  onChange: (model: FridgeModelId) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus();
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      className="model-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="model-picker-trigger"
        aria-label="Choose fridge model"
        title="Choose fridge model"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name="palette" size={26} />
      </button>
      {open && (
        <section
          id={id}
          className="model-picker-panel"
          aria-label="Fridge models"
        >
          <p className="eyebrow">Make it yours</p>
          <h2>Pick your fridge</h2>
          <div className="model-options" role="group" aria-label="Fridge style">
            {FRIDGE_MODEL_IDS.map((modelId) => (
              <button
                key={modelId}
                type="button"
                className="model-option"
                aria-pressed={value === modelId}
                aria-label={FRIDGE_MODELS[modelId].name}
                onClick={() => {
                  onChange(modelId);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <span
                  className="model-preview"
                  data-model={modelId}
                  aria-hidden="true"
                >
                  <i />
                  <b />
                </span>
                <span className="model-option-copy">
                  <strong>{FRIDGE_MODELS[modelId].name}</strong>
                  <small>{FRIDGE_MODELS[modelId].description}</small>
                </span>
                <span className="model-option-check" aria-hidden="true">
                  {value === modelId ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
