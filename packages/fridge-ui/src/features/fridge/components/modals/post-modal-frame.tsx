import { useId, type ReactNode } from "react";
import { isExpired, removalMinutes } from "../../state/board";
import { Icon } from "../../../../ui/icons";
import type { PostModalProps } from "../post-modal";
import { DialogFrame } from "../../../../ui/dialog-frame";

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
  const titleId = useId();
  const pending = post.removedAt !== null;
  const expired = isExpired(post, now);

  let heading = title;
  if (expired) {
    heading = "This post has been removed";
  } else if (pending) {
    heading = "A little time to undo";
  }

  let footerActions: ReactNode;
  if (expired) {
    footerActions = (
      <button type="button" className="primary-button" onClick={onClose}>
        Close
      </button>
    );
  } else if (pending) {
    footerActions = (
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
    );
  } else {
    footerActions = (
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
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        )}
      </>
    );
  }

  return (
    <DialogFrame labelledBy={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !expired && !saveDisabled) onSubmit();
        }}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">On the fridge</p>
            <h2 id={titleId}>{heading}</h2>
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
        <footer className="modal-footer">{footerActions}</footer>
        {!isNew && !pending && (
          <p className="removal-footnote">
            Removed posts stay greyed out for one hour. You can undo any time
            before then.
          </p>
        )}
      </form>
    </DialogFrame>
  );
}
