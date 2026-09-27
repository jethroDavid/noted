"use client";

import { BoardStage, Button } from "@noted/ui/src";
import type { BoardPost, BoardViewer } from "@noted/validators/src";
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
import { DeleteToasts } from "./delete-toast";
import { PhotoPickerModal } from "./photo-picker-modal";
import { PostCard } from "./post-card";
import type { TextPost } from "./post-kinds";
import { ConnectionPill, ViewersRow } from "./presence";
import { TextPostModal } from "./text-post-modal";

type ModalState =
  | { mode: "text-create" }
  | { mode: "text-edit"; post: TextPost }
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

  if (homeQuery.isLoading) {
    return <p className="p-8 text-center text-slate-600">Loading home…</p>;
  }
  if (homeQuery.error || !boardId) {
    return (
      <div className="p-8 text-center">
        <p role="alert" className="text-red-600">
          {homeQuery.error?.message ?? "Home not found."}
        </p>
        <Button onClick={() => homeQuery.refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <DeleteToasts
        homeId={homeId}
        boardId={boardId}
        deleted={deletedPosts}
        onMutated={onMutated}
        onDismiss={dismissToast}
      />
      <BoardStage>
        <div className="absolute top-3 left-3 z-30 flex gap-2">
          <Button onClick={() => setModal({ mode: "text-create" })}>
            + Note
          </Button>
          <Button onClick={() => setModal({ mode: "photo" })}>+ Photo</Button>
        </div>
        <div className="absolute top-3 right-3 z-30 flex items-center gap-3">
          <ViewersRow
            viewers={viewers}
            ownEmail={
              auth.status === "signed-in" ? (auth.user.email ?? "") : ""
            }
          />
          <ConnectionPill status={subscription.status} />
        </div>

        {boardQuery.isLoading ? (
          <p className="absolute inset-0 flex items-center justify-center text-white">
            Loading board…
          </p>
        ) : boardQuery.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p role="alert" className="rounded bg-white px-4 py-2 text-red-600">
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
              onDeleted={(deleted) =>
                setDeletedPosts((posts) => [
                  ...posts.filter((post) => post.id !== deleted.id),
                  deleted,
                ])
              }
              onEdit={(textPost) =>
                setModal({ mode: "text-edit", post: textPost })
              }
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
            onClose={() => setModal(null)}
            onMutated={onMutated}
          />
        )}
        {modal?.mode === "photo" && (
          <PhotoPickerModal
            homeId={homeId}
            boardId={boardId}
            onClose={() => setModal(null)}
            onMutated={onMutated}
          />
        )}
      </BoardStage>
    </>
  );
}
