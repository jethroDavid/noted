"use client";

import { Button, ConnectionPill, Spinner } from "@noted/ui/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../trpc/react";
import { useMediaEvents } from "../media/use-media-events";
import { ReelUploadModal } from "./reel-upload-modal";

export function ReelsView({ homeId }: { homeId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reelsOptions = trpc.media.listReels.queryOptions({ homeId });
  const reelsQuery = useQuery(reelsOptions);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reelsOptions.queryKey });
  };
  const subscription = useMediaEvents(homeId, invalidate);

  const [uploadOpen, setUploadOpen] = useState(false);
  // A failed reel submit reopens the picker with this draft intact so
  // the user can retry as-is. Fresh opens clear it.
  const [reelDraft, setReelDraft] = useState<{
    file: File;
    error: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation(
    trpc.media.deleteReel.mutationOptions({
      onSuccess: () => {
        setError(null);
        invalidate();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  return (
    <section
      aria-label="TV reels"
      className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <ConnectionPill status={subscription.status} />
        <Button
          onClick={() => {
            setReelDraft(null);
            setUploadOpen(true);
          }}
          className="bg-white text-slate-900 disabled:opacity-60"
        >
          + Upload reel
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded bg-white px-4 py-2 text-red-600">
          {error}
        </p>
      )}

      {reelsQuery.isLoading ? (
        <p className="py-8 text-center text-slate-300">Loading reels…</p>
      ) : reelsQuery.error ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p role="alert" className="rounded bg-white px-4 py-2 text-red-600">
            {reelsQuery.error.message}
          </p>
          <Button onClick={() => reelsQuery.refetch()}>Retry</Button>
        </div>
      ) : reelsQuery.data && reelsQuery.data.reels.length > 0 ? (
        <div className="flex snap-y snap-mandatory flex-col gap-6 overflow-y-auto pb-8">
          {reelsQuery.data.reels.map((reel) => (
            <figure
              key={reel.id}
              className="relative snap-start overflow-hidden rounded-xl bg-black shadow-2xl"
            >
              {reel.status !== "ready" || !reel.videoUrl ? (
                <div className="flex min-h-64 w-full items-center justify-center">
                  <Spinner
                    label="Uploading reel…"
                    className="border-slate-600 border-t-white"
                  />
                </div>
              ) : (
                <>
                  {/* Demo clips ship no caption tracks; captions are out of scope. */}
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={reel.videoUrl}
                    poster={reel.posterUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[70vh] w-full"
                  />
                </>
              )}
              <button
                type="button"
                aria-label="Delete reel"
                title="Delete reel"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ homeId, reelId: reel.id })}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-lg leading-none text-white shadow disabled:opacity-60"
              >
                x
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-slate-300">
          No reels yet — upload the first clip.
        </p>
      )}

      {uploadOpen && (
        <ReelUploadModal
          homeId={homeId}
          reelsQueryKey={reelsOptions.queryKey}
          initialFile={reelDraft?.file}
          initialError={reelDraft?.error}
          onClose={() => setUploadOpen(false)}
          onMutated={invalidate}
          onUploadFailed={(file, message) => {
            setReelDraft({ file, error: message });
            setUploadOpen(true);
          }}
        />
      )}
    </section>
  );
}
