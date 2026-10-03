"use client";

import { clampNormalizedCoordinate } from "@noted/domain/src";
import type { BoardPost, BoardPostsResponse } from "@noted/validators/src";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";
import {
  asEditablePost,
  POST_KIND_META,
  PostBody,
  postCardAriaLabel,
  postCardColors,
} from "./post-kinds";
import type { TextPost } from "./post-kinds";

interface PostCardProps {
  post: BoardPost;
  homeId: string;
  boardQueryKey: QueryKey;
  onMutated: () => void;
  onDeleted: (post: BoardPost) => void;
  onEdit: (post: TextPost) => void;
}

interface DragState {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

interface BoardSnapshot {
  previous: BoardPostsResponse | undefined;
}

export function PostCard({
  post,
  homeId,
  boardQueryKey,
  onMutated,
  onDeleted,
  onEdit,
}: PostCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);

  const editablePost = asEditablePost(post);
  const kindMeta = POST_KIND_META[post.kind];
  const colors = postCardColors(post);

  // Removal and moves apply instantly to the cached board and reconcile
  // with the server afterwards; failures roll back to the snapshot.
  // This stays synchronous on purpose: the cancel only marks in-flight
  // refetches as stale (their late answers are discarded), so awaiting it
  // would just open a render gap where the preview is gone but the cache
  // still shows the old state — a one-frame flicker.
  function snapshotBoard(): BoardSnapshot {
    void queryClient.cancelQueries({ queryKey: boardQueryKey });
    return {
      previous: queryClient.getQueryData<BoardPostsResponse>(boardQueryKey),
    };
  }

  function patchBoard(updater: (posts: BoardPost[]) => BoardPost[]) {
    queryClient.setQueryData<BoardPostsResponse>(boardQueryKey, (old) =>
      old ? { ...old, posts: updater(old.posts) } : old,
    );
  }

  function rollbackBoard(context: BoardSnapshot | undefined) {
    if (context?.previous) {
      queryClient.setQueryData(boardQueryKey, context.previous);
    }
  }

  function vanishPost(): BoardSnapshot {
    const snapshot = snapshotBoard();
    patchBoard((posts) =>
      posts.filter((candidate) => candidate.id !== post.id),
    );
    return snapshot;
  }

  function reportError(
    mutationError: { message: string },
    context: BoardSnapshot | undefined,
  ) {
    rollbackBoard(context);
    setError(mutationError.message);
  }

  const move = useMutation(
    trpc.boards.move.mutationOptions({
      onMutate: (target) => {
        const snapshot = snapshotBoard();
        patchBoard((posts) =>
          posts.map((candidate) =>
            candidate.id === post.id
              ? { ...candidate, x: target.x, y: target.y }
              : candidate,
          ),
        );
        return snapshot;
      },
      onSuccess: () => setError(null),
      onError: (mutationError, _variables, context) =>
        reportError(mutationError, context),
      onSettled: () => onMutated(),
    }),
  );
  const remove = useMutation(
    trpc.boards.removePost.mutationOptions({
      onMutate: () => vanishPost(),
      onSuccess: () => setError(null),
      onError: (mutationError, _variables, context) =>
        reportError(mutationError, context),
      onSettled: () => onMutated(),
    }),
  );

  const position = preview ?? { x: post.x, y: post.y };

  return (
    <div
      data-no-scene-swipe
      role={editablePost ? "button" : undefined}
      tabIndex={editablePost ? 0 : undefined}
      aria-label={postCardAriaLabel(post)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
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
        } else if (editablePost && event.button === 0) {
          onEdit(editablePost);
        }
      }}
      onKeyDown={(event) => {
        if (editablePost && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onEdit(editablePost);
        }
      }}
      className={`absolute w-[clamp(90px,26vw,160px)] touch-none rounded-[2px_5px_3px_4px] shadow-[2px_4px_6px_#394b3830] select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] ${
        preview ? "z-20 cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        backgroundColor: colors.backgroundColor,
        color: colors.color,
      }}
    >
      <PostBody post={post} />

      <span className="absolute -top-2 -right-2 flex gap-1">
        <button
          type="button"
          aria-label={kindMeta.removeAriaLabel}
          title={kindMeta.removeTitle}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            onDeleted(post);
            remove.mutate({ homeId, postId: post.id });
          }}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-[#829070]/40 bg-[#fffaf0] text-lg leading-none text-[#65705a] shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42583d]"
        >
          x
        </button>
      </span>

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
