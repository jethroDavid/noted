"use client";

import type { BoardPost } from "@noted/validators/src";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "../../trpc/react";
import { removedToastMessage, toRestoreInput } from "./post-kinds";

// How long a removed post can be brought back. The snapshot lives in this
// browser tab only; a reload inside the window still loses it, like mail.
const UNDO_WINDOW_MS = 10_000;

interface DeleteToastsProps {
  homeId: string;
  boardId: string;
  deleted: BoardPost[];
  onMutated: () => void;
  onDismiss: (postId: string) => void;
}

export function DeleteToasts({
  homeId,
  boardId,
  deleted,
  onMutated,
  onDismiss,
}: DeleteToastsProps) {
  if (deleted.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {deleted.map((post) => (
        <DeleteToastItem
          key={post.id}
          homeId={homeId}
          boardId={boardId}
          post={post}
          onMutated={onMutated}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

interface DeleteToastItemProps {
  homeId: string;
  boardId: string;
  post: BoardPost;
  onMutated: () => void;
  onDismiss: (postId: string) => void;
}

function DeleteToastItem({
  homeId,
  boardId,
  post,
  onMutated,
  onDismiss,
}: DeleteToastItemProps) {
  const trpc = useTRPC();
  const [failed, setFailed] = useState(false);
  const restore = useMutation(
    trpc.boards.restorePost.mutationOptions({
      onSuccess: () => {
        onMutated();
        onDismiss(post.id);
      },
      onError: () => setFailed(true),
    }),
  );

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(post.id), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [post.id, onDismiss]);

  // Non-ready photos are deleted without a book entry, so there is nothing
  // to restore; the toast is dismissal-only.
  const canUndo = post.kind === "text" || post.status === "ready";

  return (
    <div className="flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-[4px_10px_5px_8px] border border-[#829070]/30 bg-[#fffaf0] py-2 pr-2 pl-4 text-[17px] text-[#394b38] shadow-lg">
      <span className="max-w-64 truncate whitespace-nowrap">
        {failed ? "Couldn't undo — try again" : removedToastMessage(post)}
      </span>
      {canUndo && (
        <button
          type="button"
          disabled={restore.isPending}
          onClick={() => {
            restore.mutate({ homeId, boardId, ...toRestoreInput(post) });
          }}
          className="min-h-11 shrink-0 cursor-pointer px-3 py-1 text-[#42583d] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {restore.isPending ? "Undoing…" : "Undo"}
        </button>
      )}
    </div>
  );
}
