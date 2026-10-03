"use client";

import { Button, ConnectionPill, Modal, PaperTexture } from "@noted/ui/src";
import type { BookEntry } from "@noted/validators/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { useEffect, useId, useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";
import { useMediaEvents } from "../media/use-media-events";
import { MemoryBackdrop } from "../motion/memory-backdrop";
import { AlbumClip } from "./album-clip";
import { useAlbumTurn } from "./use-album-turn";

function AlbumRibbon() {
  const id = useId();
  const outline =
    "M4 0H24C22 24 20 44 23 62C26 81 28 95 24 110L4 107C8 91 7 78 5 62C2 43 5 22 4 0Z";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 30 110"
      preserveAspectRatio="none"
      className="home-album-ribbon"
    >
      <defs>
        <linearGradient id={`${id}-cloth`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8d6759" />
          <stop offset="0.35" stopColor="#bb9380" />
          <stop offset="0.72" stopColor="#b58a77" />
          <stop offset="1" stopColor="#926e60" />
        </linearGradient>
        <pattern
          id={`${id}-weave`}
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0H3M0 0V3"
            fill="none"
            stroke="#ecd4b5"
            strokeWidth="0.45"
            opacity="0.24"
          />
        </pattern>
      </defs>
      <path d={outline} fill={`url(#${id}-cloth)`} />
      <path d={outline} fill={`url(#${id}-weave)`} />
      <path
        d="M6 2C7 27 4 44 7 62C9 79 10 93 6 106M22 2C20 27 18 45 21 63C24 81 26 96 22 109"
        fill="none"
        stroke="#e2c6aa"
        strokeWidth="0.6"
        strokeDasharray="1.5 2.5"
        opacity="0.5"
      />
      <path
        d="M5 107L24 110"
        fill="none"
        stroke="#70594e"
        strokeWidth="0.8"
        opacity="0.45"
      />
    </svg>
  );
}

export function BookView({ homeId }: { homeId: string }) {
  const [page, setPage] = useState(0);
  const [opening, setOpening] = useState(true);
  const albumRoot = useRef<HTMLDivElement>(null);
  const turnAlbum = useAlbumTurn(albumRoot, page, opening);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const bookOptions = trpc.media.listBook.queryOptions({ homeId });
  const bookQuery = useQuery(bookOptions);
  useEffect(() => {
    if (!opening || !bookQuery.isSuccess) return;

    // Let the scene arrive before turning its introductory leaf. Opening is
    // mount-local, so realtime updates never restart this entrance.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveal = () => turnAlbum(1, () => setOpening(false));
    const delay = gsap.delayedCall(
      reduced.matches || document.hidden ? 0 : 0.65,
      reveal,
    );
    const skip = () => {
      delay.kill();
      setOpening(false);
    };
    const onHidden = () => {
      if (document.hidden) skip();
    };
    window.addEventListener("resize", skip);
    document.addEventListener("visibilitychange", onHidden);
    reduced.addEventListener("change", skip);
    return () => {
      delay.kill();
      window.removeEventListener("resize", skip);
      document.removeEventListener("visibilitychange", onHidden);
      reduced.removeEventListener("change", skip);
    };
  }, [bookQuery.isSuccess, opening, turnAlbum]);
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

  const turnPage = (step: number) => {
    const nextPage = currentPage + step;
    if (nextPage < 0 || nextPage >= pageCount) return;
    turnAlbum(step, () => setPage(nextPage));
  };

  return (
    <section
      aria-label="Photo book"
      className="relative isolate mx-auto h-full w-full"
    >
      <MemoryBackdrop
        imageSrc="/scene/sunday/book-bedroom-quiet-v2.webp"
        mobileImageSrc="/scene/sunday/book-bedroom-quiet-portrait.webp"
      />
      <div className="absolute top-1 left-4 z-10 flex items-center gap-3">
        <ConnectionPill status={subscription.status} />
        <p className="text-[14px] text-[#65705a] sm:text-[16px]">
          {entries.length === 0
            ? "Your photobook"
            : `${entries.length} ${entries.length === 1 ? "memory" : "memories"}`}
        </p>
      </div>
      <div className="flex h-full items-center justify-center pt-12 pb-5">
        <div className="home-album relative aspect-[7/5] w-[min(93%,calc((100svh_-_220px)*1.2))] max-w-[820px] shrink-0 translate-y-[18%] sm:translate-y-[8%]">
          <div
            ref={albumRoot}
            className="relative grid h-full min-h-0 grid-cols-2 [perspective:1400px] [transform-style:preserve-3d]"
          >
            {bookQuery.isLoading ? (
              <p
                role="status"
                className="col-span-2 flex items-center justify-center text-lg text-[#65705a]"
              >
                Opening the photobook…
              </p>
            ) : bookQuery.error ? (
              <div className="col-span-2 flex flex-col items-center justify-center gap-4 p-5 text-center">
                <p role="alert" className="text-lg text-[#85513e]">
                  {bookQuery.error.message}
                </p>
                <Button onClick={() => void bookQuery.refetch()}>
                  Try again
                </Button>
              </div>
            ) : entries.length > 0 && !opening ? (
              ([0, 1] as const).map((side) => (
                <div
                  key={side}
                  data-album-left={side === 0 || undefined}
                  data-album-right={side === 1 || undefined}
                  className={`home-album-leaf relative grid min-h-0 grid-rows-2 gap-3 px-[12%] pt-[12%] pb-[16%] sm:gap-5 ${side === 0 ? "home-album-leaf-left" : "home-album-leaf-right"}`}
                >
                  <PaperTexture />
                  {visibleEntries
                    .slice(side * 2, side * 2 + 2)
                    .map((entry, index) => (
                      <button
                        key={entry.id}
                        data-scene-swipe
                        type="button"
                        aria-label={
                          entry.kind === "clip"
                            ? `Open archived clip from ${entry.archivedAt.toLocaleDateString()}`
                            : undefined
                        }
                        onClick={() => {
                          setError(null);
                          setViewing(entry);
                        }}
                        className={`home-album-photo relative isolate flex min-h-0 min-w-0 cursor-pointer flex-col bg-[#f8f0dc] p-1.5 pb-2 shadow-[1px_3px_5px_#645f4930] transition-transform duration-300 hover:rotate-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] motion-reduce:transition-none sm:p-2 sm:pb-3 ${index === 0 ? "-rotate-2" : "rotate-1"}`}
                      >
                        {entry.kind === "clip" ? (
                          <AlbumClip entry={entry} enabled={!viewing} />
                        ) : (
                          <img
                            src={entry.thumbnailUrl}
                            draggable={false}
                            alt={`Archived ${entry.archivedAt.toLocaleDateString()}`}
                            className="min-h-0 w-full flex-1 bg-[#e9e3d6] object-contain"
                          />
                        )}
                        <span className="mt-1 block text-[11px] text-[#65705a] sm:mt-2 sm:text-[15px]">
                          {entry.archivedAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </button>
                    ))}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-[4%] text-center text-[12px] text-[#998c78] sm:text-[14px]"
                  >
                    {currentPage * 2 + side + 1}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div
                  data-album-left
                  className="home-album-leaf home-album-leaf-left relative flex flex-col items-center justify-center px-[12%] text-center"
                >
                  <PaperTexture />
                  <span
                    aria-hidden="true"
                    className="mb-4 text-[24px] text-[#b29d7c] sm:mb-6 sm:text-[34px]"
                  >
                    ✧
                  </span>
                  <p className="-rotate-3 text-[22px] leading-snug text-[#7c786a] sm:text-[36px]">
                    The little
                    <br />
                    things.
                  </p>
                  <span
                    aria-hidden="true"
                    className="mt-4 h-px w-10 bg-[#b29d7c]/40 sm:mt-6 sm:w-16"
                  />
                </div>
                <div
                  data-album-right
                  className="home-album-leaf home-album-leaf-right relative flex flex-col justify-center px-[12%]"
                >
                  <PaperTexture />
                  <h2 className="text-[20px] leading-tight sm:text-[31px]">
                    A little space for memories.
                  </h2>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#797968] sm:text-[18px]">
                    Photos from the fridge and clips from the TV find a home
                    here.
                  </p>
                </div>
              </>
            )}
          </div>
          <AlbumRibbon />
          {!opening &&
            pageCount > 1 &&
            ([-1, 1] as const).map((step) => (
              <button
                key={step}
                type="button"
                aria-label={
                  step === -1
                    ? "Turn to previous photobook pages"
                    : "Turn to next photobook pages"
                }
                disabled={
                  step === -1
                    ? currentPage === 0
                    : currentPage === pageCount - 1
                }
                onClick={() => turnPage(step)}
                className={`absolute inset-y-[5%] z-10 w-[calc(5%+22px)] cursor-pointer rounded transition-colors duration-200 hover:bg-[#8f7551]/10 focus-visible:bg-[#8f7551]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65705a] disabled:pointer-events-none motion-reduce:transition-none ${step === -1 ? "-left-[22px]" : "-right-[22px]"}`}
              />
            ))}
        </div>
      </div>
      {!opening && entries.length > 4 && (
        <nav
          aria-label="Photobook pages"
          className="absolute top-0 right-3 z-10 flex h-11 items-center gap-1 rounded-[4px_8px_3px_6px] bg-[#fffaf0]/85 text-[#65705a] sm:right-4"
        >
          <Button
            variant="quiet"
            className="px-2"
            disabled={currentPage === 0}
            onClick={() => turnPage(-1)}
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
            onClick={() => turnPage(1)}
            aria-label="Next photobook pages"
          >
            →
          </Button>
        </nav>
      )}

      {viewing && (
        <Modal
          title={viewing.kind === "clip" ? "Archived clip" : "Archived photo"}
          onClose={() => setViewing(null)}
        >
          {viewing.kind === "clip" ? (
            <video
              src={viewing.videoUrl}
              poster={viewing.posterUrl ?? undefined}
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
              className="max-h-[60vh] w-full rounded bg-black object-contain"
            />
          ) : (
            <img
              src={viewing.imageUrl}
              alt="Archived entry at full size"
              className="max-h-[60vh] w-full rounded object-contain"
            />
          )}
          {error && (
            <p role="alert" className="mt-3 text-[#85513e]">
              {error}
            </p>
          )}
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
