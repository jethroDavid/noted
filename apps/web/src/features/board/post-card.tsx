"use client";

import { clampNormalizedCoordinate } from "@noted/domain/src";
import type { BoardPost } from "@noted/validators/src";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";

type TextPost = Extract<BoardPost, { kind: "text" }>;

interface PostCardProps {
  post: BoardPost;
  homeId: string;
  /** Display clock (ms) for the removal countdown label. */
  now: number;
  onMutated: () => void;
  onEdit: (post: TextPost) => void;
}

interface DragState {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

function minutesLeft(deleteAfter: Date, now: number): number {
  return Math.max(0, Math.ceil((deleteAfter.getTime() - now) / 60_000));
}

export function PostCard({
  post,
  homeId,
  now,
  onMutated,
  onEdit,
}: PostCardProps) {
  const trpc = useTRPC();
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);

  const isText = post.kind === "text";
  const greyedOut = isText && post.deletionRequestedAt !== null;

  const move = useMutation(
    trpc.boards.move.mutationOptions({
      onSuccess: () => {
        setError(null);
        onMutated();
      },
      onError: (mutationError) => {
        setError(mutationError.message);
        onMutated();
      },
    }),
  );
  const requestRemoval = useMutation(
    trpc.boards.requestRemoval.mutationOptions({
      onSuccess: () => {
        setError(null);
        onMutated();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );
  const undoRemoval = useMutation(
    trpc.boards.undoRemoval.mutationOptions({
      onSuccess: () => {
        setError(null);
        onMutated();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );
  const archivePhoto = useMutation(
    trpc.boards.archivePhoto.mutationOptions({
      onSuccess: () => {
        setError(null);
        onMutated();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  const position = preview ?? { x: post.x, y: post.y };

  return (
    <div
      role={isText ? "button" : undefined}
      tabIndex={isText && !greyedOut ? 0 : undefined}
      aria-label={isText ? `Note: ${post.text.slice(0, 80)}` : "Fridge photo"}
      onPointerDown={(event) => {
        if (greyedOut || event.button !== 0) return;
        const surface = event.currentTarget.offsetParent as HTMLElement | null;
        if (!surface) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          startClientX: event.clientX,
          startClientY: event.clientY,
          originX: post.x,
          originY: post.y,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        const surface = event.currentTarget.offsetParent as HTMLElement | null;
        if (!state || !surface) return;
        const rect = surface.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const dx = (event.clientX - state.startClientX) / rect.width;
        const dy = (event.clientY - state.startClientY) / rect.height;
        if (
          Math.abs(event.clientX - state.startClientX) > 4 ||
          Math.abs(event.clientY - state.startClientY) > 4
        ) {
          state.moved = true;
        }
        setPreview({
          x: clampNormalizedCoordinate(state.originX + dx),
          y: clampNormalizedCoordinate(state.originY + dy),
        });
      }}
      onPointerUp={(event) => {
        const state = drag.current;
        drag.current = null;
        const target = preview;
        setPreview(null);
        if (!state) return;
        if (state.moved && target) {
          move.mutate({ homeId, postId: post.id, x: target.x, y: target.y });
        } else if (isText && !greyedOut && event.button === 0) {
          onEdit(post);
        }
      }}
      onKeyDown={(event) => {
        if (
          isText &&
          !greyedOut &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onEdit(post);
        }
      }}
      className={`absolute w-40 touch-none rounded shadow-lg select-none ${
        preview ? "z-20 cursor-grabbing" : "cursor-grab"
      } ${greyedOut ? "cursor-default saturate-50" : ""}`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        backgroundColor: isText ? post.backgroundColor : "#ffffff",
        color: isText ? post.foregroundColor : undefined,
      }}
    >
      {post.kind === "photo" ? (
        <div className="p-1.5">
          <img
            src={post.imageUrl}
            alt="Fridge note attachment"
            draggable={false}
            className="pointer-events-none w-full rounded-sm"
          />
        </div>
      ) : (
        <div className="max-h-56 overflow-hidden p-3 text-sm break-words whitespace-pre-wrap">
          {post.text}
        </div>
      )}

      {!greyedOut && (
        <span className="absolute -top-2 -right-2 flex gap-1">
          {isText ? (
            <button
              type="button"
              aria-label="Remove note"
              title="Remove (one-hour Undo)"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => requestRemoval.mutate({ homeId, postId: post.id })}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-sm leading-none text-white shadow"
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              aria-label="Archive photo to the book"
              title="Archive to the photo book"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => archivePhoto.mutate({ homeId, postId: post.id })}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-sm leading-none text-white shadow"
            >
              ×
            </button>
          )}
        </span>
      )}

      {greyedOut && isText && post.deleteAfter && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded bg-slate-500/70 p-2 text-center">
          <span className="text-xs font-medium text-white">
            {minutesLeft(post.deleteAfter, now) <= 0
              ? "Removing…"
              : `${minutesLeft(post.deleteAfter, now)} min left`}
          </span>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => undoRemoval.mutate({ homeId, postId: post.id })}
            className="rounded bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow"
          >
            Undo
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="absolute top-full left-0 z-30 mt-1 w-48 rounded bg-red-600 p-2 text-xs text-white shadow"
        >
          {error}
        </div>
      )}
    </div>
  );
}
