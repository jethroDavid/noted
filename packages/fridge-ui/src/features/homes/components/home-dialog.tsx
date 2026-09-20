import { useId, type ReactNode } from "react";
import { Icon } from "../../../ui/icons";
import { DialogFrame } from "../../../ui/dialog-frame";

export function HomeDialog({
  title,
  eyebrow,
  busy,
  error,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <DialogFrame
      labelledBy={titleId}
      className="home-dialog"
      onClose={onClose}
      dismissible={!busy}
    >
      <header className="modal-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </DialogFrame>
  );
}
