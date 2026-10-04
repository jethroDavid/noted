"use client";

import {
  Button,
  ConnectionPill,
  getNextReelIndex,
  HomeSceneIcon,
} from "@noted/ui/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "../../trpc/react";
import { useMediaEvents } from "../media/use-media-events";
import { MemoryBackdrop } from "../motion/memory-backdrop";
import { ReelChannel } from "./reel-channel";
import { ReelUploadModal } from "./reel-upload-modal";
import { useReelWrapScroll } from "./use-reel-wrap-scroll";
import { useTvFullscreen } from "./use-tv-fullscreen";
import { useTvSound } from "./use-tv-sound";
import { VhsTexture } from "./vhs-texture";

export function ReelsView({ homeId }: { homeId: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const fullscreen = useTvFullscreen(screen);
  const [activeId, setActiveId] = useState<string | null>(null);
  function toggleSound() {
    const clip = viewport.current?.querySelector<HTMLVideoElement>(
      `[data-reel-id="${activeId}"] video`,
    );
    if (clip) {
      const wasPlaying = !clip.paused;
      clip.muted = sound.enabled;
      if (!sound.enabled && wasPlaying) void clip.play().catch(() => {});
    }
    sound.toggle();
  }
  function unlockSound() {
    if (!sound.enabled && !sound.blocked) return;
    const clip = viewport.current?.querySelector<HTMLVideoElement>(
      `[data-reel-id="${activeId}"] video`,
    );
    if (clip) {
      const wasPlaying = !clip.paused;
      clip.muted = false;
      if (wasPlaying) void clip.play().catch(() => {});
    }
    sound.unlock();
  }
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

  const reels = reelsQuery.data?.reels ?? [];
  const activeReel = reels.find((reel) => reel.id === activeId) ?? reels[0];
  const sound = useTvSound(
    activeReel?.status !== "ready" || !activeReel.videoUrl,
  );
  const { scrollToClip, settle: settleWrap } = useReelWrapScroll(
    viewport,
    reels.length,
  );
  const readyCount = reels.filter(
    (reel) => reel.status === "ready" && reel.videoUrl,
  ).length;
  const currentId = useRef(activeId);
  useEffect(() => {
    currentId.current = activeId;
  }, [activeId]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (settleWrap()) return;
      const current = Array.from(
        element.querySelectorAll<HTMLElement>("[data-reel-id]"),
      ).find((item) => item.dataset.reelId === currentId.current);
      if (current)
        element.scrollTo({ top: current.offsetTop, behavior: "instant" });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [settleWrap]);
  function advance(id: string) {
    const next = getNextReelIndex(reels, id);
    if (next >= 0) scrollToClip(next);
  }
  const channel =
    Math.max(
      0,
      reels.findIndex((reel) => reel.id === activeId),
    ) + 1;

  return (
    <section
      aria-label="TV reels"
      className={`relative mx-auto h-full w-full ${fullscreen.active ? "z-50" : ""}`}
    >
      <div
        className={`absolute inset-x-3 top-2 z-20 items-center justify-between gap-3 sm:inset-x-6 ${fullscreen.active ? "hidden" : "flex"}`}
      >
        <ConnectionPill status={subscription.status} />
        <Button
          variant="quiet"
          className="rounded bg-[#fffaf0]/85 px-2 text-[15px]"
          onClick={() => {
            setReelDraft(null);
            setUploadOpen(true);
          }}
        >
          + Add a clip
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="absolute top-14 left-3 z-20 max-w-[600px] rounded bg-[#fffaf0] px-3 py-2 text-[#85513e]"
        >
          {error}
        </p>
      )}
      <div
        className={`relative isolate mx-auto flex h-full items-center justify-center ${fullscreen.active ? "z-30" : ""}`}
      >
        <MemoryBackdrop
          imageSrc="/scene/sunday/tv-sala-morning.webp"
          mobileImageSrc="/scene/sunday/tv-sala-morning-portrait.webp"
        />
        <div className="home-tv relative">
          <div
            ref={screen}
            onClickCapture={(event) => {
              if (!(event.target as Element).closest("[data-tv-sound-control]"))
                unlockSound();
            }}
            onKeyDownCapture={(event) => {
              if (
                (event.key === "Enter" || event.key === " ") &&
                !(event.target as Element).closest("[data-tv-sound-control]")
              )
                unlockSound();
            }}
            data-no-scene-swipe={fullscreen.active || undefined}
            role={fullscreen.active ? "dialog" : undefined}
            aria-modal={fullscreen.active || undefined}
            aria-label={fullscreen.active ? "Fullscreen TV" : undefined}
            className={`home-tv-screen ${fullscreen.active ? "home-tv-fullscreen" : ""}`}
          >
            <div
              ref={viewport}
              className="relative h-full snap-y snap-mandatory [scrollbar-width:none] overflow-y-auto overscroll-y-contain"
            >
              {reelsQuery.isLoading ? (
                <p
                  role="status"
                  className="flex h-full items-center justify-center text-xl text-[#e3e5ce]"
                >
                  Tuning in…
                </p>
              ) : reelsQuery.error ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
                  <p role="alert" className="text-lg text-[#e3e5ce]">
                    We couldn’t load your clips.
                  </p>
                  <Button onClick={() => void reelsQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : reels.length > 0 ? (
                reels.map((reel) => (
                  <ReelChannel
                    key={reel.id}
                    reel={reel}
                    isActive={reel.id === activeId}
                    viewport={viewport}
                    onActive={setActiveId}
                    deleting={remove.isPending}
                    soundEnabled={sound.enabled}
                    onAutoplayBlocked={sound.onAutoplayBlocked}
                    singleClip={readyCount === 1}
                    onEnded={advance}
                    onDelete={() => remove.mutate({ homeId, reelId: reel.id })}
                  />
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-[#d8dfc5]">
                  <HomeSceneIcon scene="tv" className="w-16 opacity-70" />
                  <p className="text-[24px]">Nothing on yet.</p>
                  <p className="max-w-[220px] text-[16px] leading-relaxed">
                    Add a family clip to watch here.
                  </p>
                </div>
              )}
            </div>
            <VhsTexture channel={activeId} />
            <button
              type="button"
              data-fullscreen-control
              onClick={fullscreen.toggle}
              aria-label={
                fullscreen.active ? "Exit fullscreen" : "Watch fullscreen"
              }
              className="absolute right-2 bottom-2 z-20 flex min-h-11 cursor-pointer items-center gap-2 rounded bg-[#253c32]/70 px-3 text-[15px] text-[#fffaf0] focus-visible:outline-2 focus-visible:outline-[#fffaf0]"
            >
              {fullscreen.active ? "↙ Exit" : "⛶ Fullscreen"}
            </button>
            <button
              type="button"
              data-tv-sound-control
              onClick={toggleSound}
              aria-pressed={sound.enabled}
              aria-label={
                sound.enabled ? "Turn TV sound off" : "Turn TV sound on"
              }
              title={
                sound.unavailable
                  ? "Clip audio only; receiver hiss unavailable"
                  : undefined
              }
              className="absolute bottom-2 left-2 z-20 min-h-11 cursor-pointer rounded bg-[#253c32]/70 px-3 text-[15px] text-[#fffaf0] focus-visible:outline-2 focus-visible:outline-[#fffaf0]"
            >
              {sound.blocked
                ? "Tap for sound"
                : sound.enabled
                  ? "Sound on"
                  : "Sound off"}
            </button>
          </div>
          <div
            className={`absolute inset-x-[5%] bottom-[2%] flex h-[14%] items-center justify-between text-[#4f6150] ${fullscreen.active ? "invisible" : ""}`}
          >
            <div
              className="home-tv-vents h-[35%] w-[17%] opacity-70"
              aria-hidden="true"
            />
            <span className="text-[17px] font-bold tracking-tight">
              noted.
              <span className="ml-3 text-[14px] font-normal">
                {reels.length > 0 ? `${channel} / ${reels.length}` : ""}
              </span>
            </span>
            <span aria-hidden="true" className="flex w-[17%] justify-end">
              <span
                className={`size-1.5 rounded-full ${sound.enabled ? "bg-[#829070]" : "bg-[#bd9162]"}`}
                aria-hidden="true"
              />
            </span>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {reels.length > 0
          ? `Clip ${channel} of ${reels.length} · Scroll up or down to change clips`
          : "Your family’s little moments, on the big screen."}
      </p>

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
