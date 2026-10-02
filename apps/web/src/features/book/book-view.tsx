"use client";

import { Button, ConnectionPill, Modal } from "@noted/ui/src";
import type { BookEntry } from "@noted/validators/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../trpc/react";
import { useMediaEvents } from "../media/use-media-events";

export function BookView({ homeId }: { homeId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const bookOptions = trpc.media.listBook.queryOptions({ homeId });
  const bookQuery = useQuery(bookOptions);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookOptions.queryKey });
  };
  const subscription = useMediaEvents(homeId, invalidate);

  const [viewing, setViewing] = useState<BookEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation(
    trpc.media.deleteBookEntry.mutationOptions({
      onSuccess: () => {
        setError(null);
        setViewing(null);
        invalidate();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  return (
    <section
      aria-label="Photo book"
      className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          Photos removed from the fridge archive here.
        </p>
        <ConnectionPill status={subscription.status} />
      </div>

      {error && (
        <p role="alert" className="rounded bg-white px-4 py-2 text-red-600">
          {error}
        </p>
      )}

      {bookQuery.isLoading ? (
        <p className="py-8 text-center text-slate-300">Loading book…</p>
      ) : bookQuery.error ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p role="alert" className="rounded bg-white px-4 py-2 text-red-600">
            {bookQuery.error.message}
          </p>
          <Button onClick={() => bookQuery.refetch()}>Retry</Button>
        </div>
      ) : bookQuery.data && bookQuery.data.entries.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {bookQuery.data.entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setViewing(entry)}
              className="overflow-hidden rounded-lg bg-black shadow hover:ring-2 hover:ring-white"
            >
              <img
                src={entry.thumbnailUrl}
                alt={`Archived ${entry.archivedAt.toLocaleDateString()}`}
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-slate-300">
          The book is empty — archived photos land here.
        </p>
      )}

      {viewing && (
        <Modal title="Archived photo" onClose={() => setViewing(null)}>
          <img
            src={viewing.imageUrl}
            alt="Archived entry at full size"
            className="max-h-[60vh] w-full rounded object-contain"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ homeId, entryId: viewing.id })}
              className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {remove.isPending ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
