"use client";

import { clampBoardPostPosition, PaperTexture } from "@noted/ui/src";
import type { BoardPost, BoardPostsResponse } from "@noted/validators/src";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTRPC } from "../../trpc/react";
import { PostBody, postCardAriaLabel, postCardColors } from "./post-kinds";

interface PostCardProps {
  post: BoardPost;
  homeId: string;
  boardQueryKey: QueryKey;
  onMutated: () => void;
  onOpen: (post: BoardPost) => void;
}

interface DragState {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
  target: { x: number; y: number };
}

interface BoardSnapshot {
  previous: BoardPostsResponse | undefined;
}

export function PostCard({
  post,
  homeId,
  boardQueryKey,
  onMutated,
  onOpen,
}: PostCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{
    surface: { width: number; height: number };
    card: { width: number; height: number };
  } | null>(null);
  useLayoutEffect(() => {
    const element = card.current;
    const surface = element?.offsetParent as HTMLElement | null;
    if (!element || !surface) return;
    const measure = () => {
      const next = {
        surface: { width: surface.clientWidth, height: surface.clientHeight },
        card: { width: element.offsetWidth, height: element.offsetHeight },
      };
      setSize((previous) =>
        previous &&
        previous.surface.width === next.surface.width &&
        previous.surface.height === next.surface.height &&
        previous.card.width === next.card.width &&
        previous.card.height === next.card.height
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const colors = postCardColors(post);
  // Stable per post, so realtime snapshots do not shuffle the little magnets.
  const magnetColors = ["#bf795f", "#829a7b", "#d1ad5f", "#789ca0"];
  const magnetColor =
    magnetColors[parseInt(post.id.slice(-2), 16) % magnetColors.length];

  // Moves apply instantly to the cached board and reconcile
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
  const desiredPosition = preview ?? { x: post.x, y: post.y };
  const position = size
    ? clampBoardPostPosition(desiredPosition, size.surface, size.card)
    : desiredPosition;

  return (
    <div
      ref={card}
      data-no-scene-swipe
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={postCardAriaLabel(post)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        const surface = event.currentTarget.offsetParent as HTMLElement | null;
        if (!surface) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const origin = clampBoardPostPosition(
          position,
          { width: surface.clientWidth, height: surface.clientHeight },
          {
            width: event.currentTarget.offsetWidth,
            height: event.currentTarget.offsetHeight,
          },
        );
        drag.current = {
          startClientX: event.clientX,
          startClientY: event.clientY,
          originX: origin.x,
          originY: origin.y,
          moved: false,
          target: origin,
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
        if (!state.moved) return;
        state.target = clampBoardPostPosition(
          { x: state.originX + dx, y: state.originY + dy },
          { width: surface.clientWidth, height: surface.clientHeight },
          {
            width: event.currentTarget.offsetWidth,
            height: event.currentTarget.offsetHeight,
          },
        );
        setPreview(state.target);
      }}
      onPointerUp={() => {
        const state = drag.current;
        drag.current = null;
        setPreview(null);
        if (!state) return;
        suppressClick.current = state.moved;
        if (state.moved) {
          move.mutate({
            homeId,
            postId: post.id,
            x: state.target.x,
            y: state.target.y,
          });
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        suppressClick.current = true;
        setPreview(null);
      }}
      onClick={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        event.currentTarget.focus();
        onOpen(post);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(post);
        }
      }}
      className={`absolute w-[clamp(90px,26vw,160px)] touch-none rounded-[2px_5px_3px_4px] transition-shadow duration-200 select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] motion-reduce:transition-none ${
        preview
          ? "z-20 cursor-grabbing shadow-[4px_9px_10px_#394b3840]"
          : "cursor-grab shadow-[2px_4px_6px_#394b3830] hover:shadow-[3px_6px_8px_#394b3840]"
      }`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        backgroundColor: colors.backgroundColor,
        color: colors.color,
        maxWidth: "calc(100% - 12px)",
        visibility: size ? "visible" : "hidden",
      }}
    >
      <PaperTexture />
      <PostBody post={post} />

      <span
        aria-hidden="true"
        className="home-fridge-magnet pointer-events-none absolute -top-2 left-[43%] size-5 rounded-full"
        style={{ "--magnet-color": magnetColor } as CSSProperties}
      />

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
