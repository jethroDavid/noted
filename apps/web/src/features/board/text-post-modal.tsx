"use client";

import { Button, Modal } from "@noted/ui/src";
import type { BoardPost } from "@noted/validators/src";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";

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
}

export function TextPostModal({
  homeId,
  boardId,
  post,
  onClose,
  onMutated,
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
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

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

  const pending = create.isPending || edit.isPending;

  return (
    <Modal title={post ? "Edit note" : "New note"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
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
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Note
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
            maxLength={2000}
            rows={5}
            className="rounded border border-slate-300 p-2 text-slate-900"
          />
        </label>

        <fieldset>
          <legend className="text-sm text-slate-700">Paper</legend>
          <div className="mt-1 flex gap-2">
            {PAPER_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.name}
                aria-label={`Paper ${color.name}`}
                aria-pressed={backgroundColor === color.value}
                onClick={() => setBackgroundColor(color.value)}
                className={`h-8 w-8 rounded-full border-2 ${
                  backgroundColor === color.value
                    ? "border-slate-900"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-slate-700">Ink</legend>
          <div className="mt-1 flex gap-2">
            {INK_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.name}
                aria-label={`Ink ${color.name}`}
                aria-pressed={foregroundColor === color.value}
                onClick={() => setForegroundColor(color.value)}
                className={`h-8 w-8 rounded-full border-2 ${
                  foregroundColor === color.value
                    ? "border-slate-900"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            onClick={onClose}
            className="bg-slate-200 text-slate-900"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : post ? "Save" : "Stick it"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
