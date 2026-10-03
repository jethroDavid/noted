"use client";

import { useGSAP } from "@gsap/react";
import { Button, ConnectionPill, HomeSceneIcon, Modal } from "@noted/ui/src";
import type { BookEntry } from "@noted/validators/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";
import { useMediaEvents } from "../media/use-media-events";

gsap.registerPlugin(useGSAP);
function AlbumSpread({
  children,
  direction,
}: {
  children: ReactNode;
  direction: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root.current,
          {
            rotationY: direction * 18,
            opacity: 0.4,
            transformPerspective: 900,
          },
          {
            rotationY: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power2.out",
            clearProps: "transform",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root },
  );
  return (
    <div
      ref={root}
      className="home-album relative h-full min-h-0 px-4 py-6 sm:px-9 sm:py-8"
    >
      {children}
    </div>
  );
}

export function BookView({ homeId }: { homeId: string }) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
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

  const entries = bookQuery.data?.entries ?? [];
  const pageCount = Math.max(1, Math.ceil(entries.length / 4));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleEntries = entries.slice(currentPage * 4, currentPage * 4 + 4);

  return (
    <section
      aria-label="Photo book"
      className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col"
    >
      <div className="absolute top-1 left-4 z-10 flex items-center gap-3">
        <p className="sr-only">Photos saved from your fridge.</p>
        <ConnectionPill status={subscription.status} />
      </div>
      {error && (
        <p
          role="alert"
          className="absolute top-8 left-4 z-10 rounded bg-[#fffaf0] px-3 py-2 text-[#85513e]"
        >
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 pt-1">
        <AlbumSpread key={currentPage} direction={direction}>
          {bookQuery.isLoading ? (
            <p
              role="status"
              className="py-24 text-center text-lg text-[#65705a]"
            >
              Opening the photobook…
            </p>
          ) : bookQuery.error ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p role="alert" className="text-lg text-[#85513e]">
                {bookQuery.error.message}
              </p>
              <Button onClick={() => void bookQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : entries.length > 0 ? (
            <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-x-6 gap-y-4 sm:gap-x-16 sm:gap-y-6">
              {visibleEntries.map((entry) => (
                <button
                  key={entry.id}
                  data-scene-swipe
                  type="button"
                  onClick={() => setViewing(entry)}
                  className="group flex min-h-0 min-w-0 cursor-pointer flex-col bg-[#fffdf6] p-2 pb-3 shadow-[1px_3px_5px_#645f4930] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d]"
                >
                  <img
                    src={entry.thumbnailUrl}
                    draggable={false}
                    alt={`Archived ${entry.archivedAt.toLocaleDateString()}`}
                    className="min-h-0 w-full flex-1 object-cover"
                  />
                  <span className="mt-2 block text-[13px] text-[#65705a] sm:text-[16px]">
                    {entry.archivedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid h-full grid-cols-2 items-center gap-6 sm:gap-16">
              <HomeSceneIcon
                scene="book"
                className="mx-auto w-full max-w-[130px] text-[#9b9f80]"
              />
              <div className="pr-1">
                <h2 className="text-[25px] leading-tight sm:text-[31px]">
                  A little space for memories.
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-[#65705a] sm:text-[18px]">
                  Photos archived from the fridge find a home here.
                </p>
              </div>
            </div>
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-0 flex w-full justify-around text-[13px] text-[#a49c81]"
          >
            <span>{currentPage * 2 + 1}</span>
            <span>{currentPage * 2 + 2}</span>
          </div>
        </AlbumSpread>
      </div>
      {entries.length > 4 && (
        <nav
          aria-label="Photobook pages"
          className="flex h-11 shrink-0 items-center justify-center gap-3"
        >
          <Button
            variant="quiet"
            className="px-2"
            disabled={currentPage === 0}
            onClick={() => {
              setDirection(-1);
              setPage(currentPage - 1);
            }}
            aria-label="Previous photobook pages"
          >
            ←
          </Button>
          <p role="status" className="text-[16px] text-[#65705a]">
            {currentPage + 1} / {pageCount}
          </p>
          <Button
            variant="quiet"
            className="px-2"
            disabled={currentPage >= pageCount - 1}
            onClick={() => {
              setDirection(1);
              setPage(currentPage + 1);
            }}
            aria-label="Next photobook pages"
          >
            →
          </Button>
        </nav>
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
              className="min-h-11 cursor-pointer rounded-[4px_8px_3px_6px] bg-[#85513e] px-5 py-2 text-[17px] text-[#fffaf0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85513e] disabled:opacity-60"
            >
              {remove.isPending ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
