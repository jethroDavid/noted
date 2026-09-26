"use client";

import { BoardStage, Button } from "@noted/ui/src";
import type { BoardPost } from "@noted/validators/src";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "../../trpc/react";
import { PhotoPickerModal } from "./photo-picker-modal";
import { PostCard } from "./post-card";
import { TextPostModal } from "./text-post-modal";

type TextPost = Extract<BoardPost, { kind: "text" }>;

type ModalState =
  | { mode: "text-create" }
  | { mode: "text-edit"; post: TextPost }
  | { mode: "photo" }
  | null;

// Temporary Phase 1 transport: refetch the board on an interval.
// Phase 2 replaces this with WebSocket plus Redis realtime.
const REFETCH_INTERVAL_MS = 2000;

export function BoardView({ homeId }: { homeId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);

  const homeQuery = useQuery(trpc.homes.get.queryOptions({ homeId }));
  const boardId = homeQuery.data?.home.boardId;
  const boardQueryOptions = trpc.boards.get.queryOptions({
    homeId,
    boardId: boardId ?? "00000000-0000-0000-0000-000000000000",
  });
  const boardQuery = useQuery({
    ...boardQueryOptions,
    enabled: !!boardId,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  // Display clock for the removal countdowns (minute precision). Expiry
  // itself is decided by database time in SQL, so client skew can only shift
  // the label, never the Undo window.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const onMutated = () => {
    void queryClient.invalidateQueries({
      queryKey: boardQueryOptions.queryKey,
    });
  };

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
    <BoardStage>
      <div className="absolute top-3 left-3 z-30 flex gap-2">
        <Button onClick={() => setModal({ mode: "text-create" })}>
          + Note
        </Button>
        <Button onClick={() => setModal({ mode: "photo" })}>+ Photo</Button>
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
            now={now}
            onMutated={onMutated}
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
  );
}
