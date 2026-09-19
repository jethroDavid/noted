import { useEffect, useId, useRef, type ReactNode } from "react";
import { isExpired, removalMinutes } from "../board";
import { Icon } from "../icons";
import type { PostModalProps } from "../post-modal";

export function PostModalFrame({
  post,
  isNew,
  now,
  onClose,
  onRemove,
  onUndo,
  title,
  children,
  onSubmit,
  saveLabel,
  saveDisabled = false,
}: Omit<PostModalProps, "assets" | "onSave"> & {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pending = post.removedAt !== null;
  const expired = isExpired(post, now);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="post-dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), textarea:not(:disabled), audio[controls], [tabindex='0']",
          ),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !expired && !saveDisabled) onSubmit();
        }}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">On the fridge</p>
            <h2 id={titleId}>
              {expired
                ? "This post has been removed"
                : pending
                  ? "A little time to undo"
                  : title}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close editor"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {pending && (
          <p className="removal-message" role="status">
            {expired
              ? "The one-hour Undo period has ended."
              : `Greyed out for now. You have ${removalMinutes(post, now)} minutes left to bring it back.`}
          </p>
        )}
        {!expired && children}
        <footer className="modal-footer">
          {expired ? (
            <button type="button" className="primary-button" onClick={onClose}>
              Close
            </button>
          ) : pending ? (
            <>
              <button type="button" className="text-button" onClick={onClose}>
                Keep greyed out
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => onUndo(post.id)}
              >
                Undo removal
              </button>
            </>
          ) : (
            <>
              {isNew ? (
                <button type="button" className="text-button" onClick={onClose}>
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => onRemove(post.id)}
                >
                  Remove from fridge
                </button>
              )}
              {saveLabel ? (
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saveDisabled}
                >
                  {saveLabel}
                  <Icon name="arrow" size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={onClose}
                >
                  Done
                </button>
              )}
            </>
          )}
        </footer>
        {!isNew && !pending && (
          <p className="removal-footnote">
            Removed posts stay greyed out for one hour. You can undo any time
            before then.
          </p>
        )}
      </form>
    </dialog>
  );
}
