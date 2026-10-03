"use client";

import { Button, Modal } from "@noted/ui/src";
import type { BoardPost } from "@noted/validators/src";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../trpc/react";
import { PostRemovalAction } from "./post-removal-action";
import type { PostRemovalProps } from "./post-removal-action";

type TextPost = Extract<BoardPost, { kind: "text" }>;

const PAPER_COLORS = [
  { name: "Butter", value: "#f5dfa0" },
  { name: "Rose", value: "#efcac3" },
  { name: "Lavender", value: "#dcd5ed" },
  { name: "Sage", value: "#d4dfc5" },
  { name: "Cream", value: "#f6f1df" },
] as const;

const INK_COLORS = [
  { name: "Charcoal", value: "#33352e" },
  { name: "Forest", value: "#344e40" },
  { name: "Berry", value: "#813e4c" },
] as const;

interface TextPostModalProps {
  homeId: string;
  boardId: string;
  /** Set when editing; null when creating. */
  post: TextPost | null;
  onClose: () => void;
  onMutated: () => void;
  removal?: PostRemovalProps;
}

export function TextPostModal({
  homeId,
  boardId,
  post,
  onClose,
  onMutated,
  removal,
}: TextPostModalProps) {
  const trpc = useTRPC();
  const [text, setText] = useState(post?.text ?? "");
  const [backgroundColor, setBackgroundColor] = useState(
    post?.backgroundColor ?? PAPER_COLORS[0].value,
  );
  const [foregroundColor, setForegroundColor] = useState(
    post?.foregroundColor ?? INK_COLORS[0].value,
  );
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.boards.createText.mutationOptions({
      onSuccess: () => {
        onMutated();
        onClose();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );
  const edit = useMutation(
    trpc.boards.editContent.mutationOptions({
      onSuccess: () => {
        onMutated();
        onClose();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  const saving = create.isPending || edit.isPending;
  const pending = saving || removal?.pending;

  return (
    <Modal title={post ? "Edit note" : "New note"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setError(null);
          if (post) {
            edit.mutate({
              homeId,
              postId: post.id,
              text,
              foregroundColor,
              backgroundColor,
            });
          } else {
            create.mutate({
              homeId,
              boardId,
              text,
              foregroundColor,
              backgroundColor,
              x: 0.5,
              y: 0.45,
            });
          }
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-[17px] text-[#394b38]">
          Note
          <textarea
            data-autofocus
            value={text}
            disabled={pending}
            onChange={(event) => setText(event.target.value)}
            required
            maxLength={2000}
            rows={5}
            className="rounded-[3px_7px_4px_6px] border border-[#829070]/40 p-4 text-[19px] leading-relaxed shadow-[inset_0_12px_16px_-14px_#394b3840,1px_3px_5px_#394b3810] focus:outline-2 focus:outline-offset-2 focus:outline-[#829070]/50 disabled:opacity-60"
            style={{ backgroundColor, color: foregroundColor }}
          />
        </label>

        <fieldset>
          <legend className="text-[17px] text-[#394b38]">Paper</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAPER_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                disabled={pending}
                title={color.name}
                aria-label={`Paper ${color.name}`}
                aria-pressed={backgroundColor === color.value}
                onClick={() => setBackgroundColor(color.value)}
                className={`flex size-11 cursor-pointer items-center justify-center rounded-[3px_7px_4px_6px] border-2 text-xl text-[#33352e] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42583d] disabled:cursor-wait disabled:opacity-60 ${
                  backgroundColor === color.value
                    ? "border-[#42583d]"
                    : "border-[#394b38]/15 hover:border-[#829070]"
                }`}
                style={{ backgroundColor: color.value }}
              >
                {backgroundColor === color.value && (
                  <span aria-hidden="true">✓</span>
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[17px] text-[#394b38]">Ink</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {INK_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                disabled={pending}
                title={color.name}
                aria-label={`Ink ${color.name}`}
                aria-pressed={foregroundColor === color.value}
                onClick={() => setForegroundColor(color.value)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px_7px_4px_6px] border-2 bg-[#fffaf0] px-2 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42583d] disabled:cursor-wait disabled:opacity-60 ${
                  foregroundColor === color.value
                    ? "border-[#42583d] shadow-sm"
                    : "border-[#829070]/25 hover:border-[#829070]"
                }`}
                style={{ color: color.value }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-sm text-[#fffaf0]"
                  style={{ backgroundColor: color.value }}
                >
                  {foregroundColor === color.value ? "✓" : ""}
                </span>
                {color.name}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-[17px] text-[#85513e]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-2">
          {post && removal && (
            <PostRemovalAction kind="text" disabled={saving} {...removal} />
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={onClose} variant="quiet">
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {saving ? "Saving…" : post ? "Save" : "Stick it"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
