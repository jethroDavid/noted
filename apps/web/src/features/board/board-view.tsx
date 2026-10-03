"use client";

import { BoardStage, Button, ConnectionPill } from "@noted/ui/src";
import type {
  BoardPost,
  BoardPostsResponse,
  BoardViewer,
} from "@noted/validators/src";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../platform/auth/auth-provider";
import { useTRPC } from "../../trpc/react";
import { MemoryBackdrop } from "../motion/memory-backdrop";
import { DeleteToasts } from "./delete-toast";
import { PhotoPickerModal } from "./photo-picker-modal";
import { PhotoPostModal } from "./photo-post-modal";
import { PostCard } from "./post-card";
import type { PhotoPost, TextPost } from "./post-kinds";
import { ViewersRow } from "./presence";
import { TextPostModal } from "./text-post-modal";

type ModalState =
  | { mode: "text-create" }
  | { mode: "text-edit"; post: TextPost }
  | { mode: "photo-view"; post: PhotoPost }
  | { mode: "photo" }
  | null;

// Presence refreshes renew the viewer's Redis entry; the server prunes
// viewers missing three refreshes.
const PRESENCE_REFRESH_INTERVAL_MS = 20_000;

export function BoardView({ homeId }: { homeId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [modal, setModal] = useState<ModalState>(null);
  const [viewers, setViewers] = useState<BoardViewer[]>([]);

  const homeQuery = useQuery(trpc.homes.get.queryOptions({ homeId }));
  const boardId = homeQuery.data?.home.boardId;

  const boardQueryOptions = trpc.boards.get.queryOptions({
    homeId,
    boardId: boardId ?? "00000000-0000-0000-0000-000000000000",
  });

  const boardQuery = useQuery({
    ...boardQueryOptions,
    enabled: !!boardId,
  });

  const onMutated = () => {
    void queryClient.invalidateQueries({
      queryKey: boardQueryOptions.queryKey,
    });
  };

  // Board events only invalidate: the refetch is served from the Redis
  // cache. (Re)subscribing reloads state, so a reconnect heals any gap.
  // Terminal subscription errors (revoked membership) also refetch: the
  // read then 404s into the "Home not found" screen.
  const subscription = useSubscription(
    trpc.boards.onEvent.subscriptionOptions(
      boardId ? { homeId, boardId } : skipToken,
      {
        onStarted: () => onMutated(),
        onData: (event) => {
          if (event.type === "board-changed") onMutated();
          else setViewers(event.viewers);
        },
        onError: () => onMutated(),
      },
    ),
  );

  const refreshPresence = useMutation(
    trpc.boards.refreshPresence.mutationOptions({
      // The HTTP response refreshes viewers even if a presence event was
      // lost in the stream. A failed refresh (revoked while idle) refetches
      // into the "Home not found" screen instead.
      onSuccess: (event) => setViewers(event.viewers),
      onError: () => onMutated(),
    }),
  );

  useEffect(() => {
    if (!boardId || subscription.status !== "pending") return;

    const timer = setInterval(() => {
      refreshPresence.mutate({ homeId, boardId });
    }, PRESENCE_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [boardId, homeId, subscription.status, refreshPresence]);

  // Snapshots of just-removed posts, one toast each. useCallback keeps the
  // identity stable so toast expiry timers never reset on re-render.
  const [deletedPosts, setDeletedPosts] = useState<BoardPost[]>([]);
  const dismissToast = useCallback((postId: string) => {
    setDeletedPosts((posts) => posts.filter((post) => post.id !== postId));
  }, []);

  // The controller stays mounted while a removed card disappears from the
  // board, so failures can restore it and leave its dialog open for retry.
  const remove = useMutation(
    trpc.boards.removePost.mutationOptions({
      onMutate: (target) => {
        void queryClient.cancelQueries({
          queryKey: boardQueryOptions.queryKey,
        });
        const previous = queryClient.getQueryData<BoardPostsResponse>(
          boardQueryOptions.queryKey,
        );
        const post = previous?.posts.find(
          (candidate) => candidate.id === target.postId,
        );
        queryClient.setQueryData<BoardPostsResponse>(
          boardQueryOptions.queryKey,
          (old) =>
            old
              ? {
                  ...old,
                  posts: old.posts.filter(
                    (candidate) => candidate.id !== target.postId,
                  ),
                }
              : old,
        );
        return { previous, post };
      },
      onSuccess: (_result, target, context) => {
        if (context?.post) {
          const deleted = context.post;
          setDeletedPosts((posts) => [
            ...posts.filter((post) => post.id !== deleted.id),
            deleted,
          ]);
        }
        setModal((current) =>
          current && "post" in current && current.post.id === target.postId
            ? null
            : current,
        );
      },
      onError: (_error, _target, context) => {
        if (context?.previous)
          queryClient.setQueryData(
            boardQueryOptions.queryKey,
            context.previous,
          );
      },
      onSettled: onMutated,
    }),
  );
  const removal = {
    pending: remove.isPending,
    error:
      modal && "post" in modal && remove.variables?.postId === modal.post.id
        ? (remove.error?.message ?? null)
        : null,
    onRemove: () => {
      if (modal && "post" in modal && !remove.isPending)
        remove.mutate({ homeId, postId: modal.post.id });
    },
  };

  // A failed photo submit reopens the picker with this draft intact so
  // the user can retry as-is. Fresh opens clear it.
  const [photoDraft, setPhotoDraft] = useState<{
    file: File;
    error: string;
  } | null>(null);

  if (homeQuery.isLoading) {
    return <p className="p-8 text-center text-[#65705a]">Loading home…</p>;
  }
  if (homeQuery.error || !boardId) {
    return (
      <div className="p-8 text-center">
        <p role="alert" className="text-[#85513e]">
          {homeQuery.error?.message ?? "Home not found."}
        </p>
        <Button onClick={() => homeQuery.refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <DeleteToasts
        homeId={homeId}
        boardId={boardId}
        deleted={deletedPosts}
        onMutated={onMutated}
        onDismiss={dismissToast}
      />
      <div className="absolute inset-x-3 top-2 z-30 mx-auto flex items-center justify-between gap-2 sm:inset-x-6">
        <div className="flex items-center gap-3">
          <ConnectionPill status={subscription.status} />
          <div className="hidden sm:block">
            <ViewersRow
              viewers={viewers}
              ownEmail={
                auth.status === "signed-in" ? (auth.user.email ?? "") : ""
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="quiet"
            className="rounded bg-[#fffaf0]/85 px-2 text-[15px]"
            onClick={() => setModal({ mode: "text-create" })}
          >
            + Note
          </Button>
          <Button
            variant="quiet"
            className="rounded bg-[#fffaf0]/85 px-2 text-[15px]"
            onClick={() => {
              setPhotoDraft(null);
              setModal({ mode: "photo" });
            }}
          >
            + Photo
          </Button>
        </div>
      </div>
      <BoardStage
        surfaceSrc="/scene/sunday/fridge-cream.webp"
        backdrop={
          <MemoryBackdrop
            imageSrc="/scene/sunday/fridge-kitchen-afternoon.webp"
            mobileImageSrc="/scene/sunday/fridge-kitchen-afternoon-portrait.webp"
          />
        }
      >
        {boardQuery.isLoading ? (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center text-lg text-[#394b38]"
          >
            Loading board…
          </p>
        ) : boardQuery.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p
              role="alert"
              className="rounded bg-white px-4 py-2 text-[#85513e]"
            >
              {boardQuery.error.message}
            </p>
            <Button onClick={() => boardQuery.refetch()}>Retry</Button>
          </div>
        ) : (
          boardQuery.data?.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              homeId={homeId}
              boardQueryKey={boardQueryOptions.queryKey}
              onMutated={onMutated}
              onOpen={(post) => {
                if (!remove.isPending) remove.reset();
                setModal(
                  post.kind === "text"
                    ? { mode: "text-edit", post }
                    : { mode: "photo-view", post },
                );
              }}
            />
          ))
        )}

        {modal?.mode === "text-create" && (
          <TextPostModal
            homeId={homeId}
            boardId={boardId}
            post={null}
            onClose={() => setModal(null)}
            onMutated={onMutated}
          />
        )}
        {modal?.mode === "text-edit" && (
          <TextPostModal
            homeId={homeId}
            boardId={boardId}
            post={modal.post}
            removal={removal}
            onClose={() => setModal(null)}
            onMutated={onMutated}
          />
        )}
        {modal?.mode === "photo-view" && (
          <PhotoPostModal
            post={
              boardQuery.data?.posts.find(
                (post): post is PhotoPost =>
                  post.id === modal.post.id && post.kind === "photo",
              ) ?? modal.post
            }
            removal={removal}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.mode === "photo" && (
          <PhotoPickerModal
            homeId={homeId}
            boardId={boardId}
            boardQueryKey={boardQueryOptions.queryKey}
            initialFile={photoDraft?.file}
            initialError={photoDraft?.error}
            onClose={() => setModal(null)}
            onMutated={onMutated}
            onUploadFailed={(file, message) => {
              setPhotoDraft({ file, error: message });
              setModal({ mode: "photo" });
            }}
          />
        )}
      </BoardStage>
    </div>
  );
}
