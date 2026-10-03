"use client";

import { daysUntilReelExpiry } from "@noted/domain/src";
import { Spinner } from "@noted/ui/src";
import type { Reel } from "@noted/validators/src";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

function expiryLabel(expiresAt: Date): string {
  const days = daysUntilReelExpiry(expiresAt, new Date());
  if (days <= 0) return "Moving to photobook soon";
  if (days === 1) return "Photobook tomorrow";
  return `Photobook in ${days} days`;
}

export function ReelChannel({
  reel,
  viewport,
  onActive,
  onDelete,
  deleting,
  soundEnabled,
  onAutoplayBlocked,
  onPlayback,
  onEnded,
  singleClip,
  isActive,
}: {
  reel: Reel;
  viewport: RefObject<HTMLDivElement | null>;
  onActive: (id: string) => void;
  onDelete: () => void;
  deleting: boolean;
  soundEnabled: boolean;
  onAutoplayBlocked: () => void;
  onPlayback: (id: string, playing: boolean) => void;
  onEnded: (id: string) => void;
  singleClip: boolean;
  isActive: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(false);
  const paused = useRef(false);
  const menuOpenRef = useRef(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const startPlayback = useCallback(() => {
    const clip = video.current;
    const canPlay = () =>
      active.current &&
      !paused.current &&
      !menuOpenRef.current &&
      document.visibilityState === "visible";
    if (!clip || !canPlay()) {
      clip?.pause();
      return;
    }
    void clip.play().catch((error: unknown) => {
      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError" &&
        !clip.muted &&
        clip.paused &&
        canPlay()
      ) {
        // Keep the reel moving when audible autoplay needs a first gesture.
        clip.muted = true;
        onAutoplayBlocked();
        void clip.play().catch(() => setPlaying(false));
      } else if (!(
        error instanceof DOMException && error.name === "AbortError"
      ))
        setPlaying(false);
    });
  }, [onAutoplayBlocked]);
  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }
  useEffect(() => {
    const clip = video.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6,
        );
        if (visible && !active.current) {
          paused.current = false;
          if (clip) clip.currentTime = 0;
          onActive(reel.id);
        }
        active.current = visible;
        startPlayback();
      },
      { root: viewport.current, threshold: 0.6 },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", startPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", startPlayback);
      clip?.pause();
    };
  }, [reel.id, reel.videoUrl, onActive, viewport, startPlayback]);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
    if (menuOpen) video.current?.pause();
    else startPlayback();
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen, startPlayback]);
  return (
    <figure
      ref={root}
      data-reel-id={reel.id}
      className="relative flex h-full min-h-full snap-start items-center justify-center bg-[#253c32]"
    >
      {reel.status !== "ready" || !reel.videoUrl ? (
        <Spinner
          label="Uploading reel…"
          className="border-[#829070] border-t-[#fffaf0]"
        />
      ) : (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Family uploads do not include caption tracks. */}
          <video
            ref={video}
            src={reel.videoUrl}
            poster={reel.posterUrl ?? undefined}
            muted={!soundEnabled}
            loop={singleClip}
            playsInline
            preload="metadata"
            onPlaying={() => {
              setPlaying(true);
              onPlayback(reel.id, true);
            }}
            onPause={() => {
              setPlaying(false);
              onPlayback(reel.id, false);
            }}
            onEnded={() => {
              if (active.current) onEnded(reel.id);
            }}
            className="home-vhs-video h-full w-full object-contain"
          />
          <button
            type="button"
            tabIndex={isActive ? 0 : -1}
            data-scene-swipe
            aria-label={playing ? "Pause reel" : "Play reel"}
            onClick={() => {
              if (menuOpen) {
                closeMenu();
                return;
              }
              paused.current = playing;
              if (playing) video.current?.pause();
              else startPlayback();
            }}
            className="absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#fffaf0]"
          >
            {!playing && (
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full bg-[#fffaf0]/75 text-2xl text-[#394b38]"
              >
                ▷
              </span>
            )}
          </button>
        </>
      )}
      {reel.expiresAt && (
        <span className="pointer-events-none absolute top-2 left-2 z-20 rounded bg-[#253c32]/60 px-2 py-1 text-[13px] text-[#fffaf0]">
          {expiryLabel(reel.expiresAt)}
        </span>
      )}
      <button
        ref={menuButton}
        type="button"
        tabIndex={isActive ? 0 : -1}
        aria-label="Reel options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
        className="absolute top-2 right-2 z-20 flex size-11 cursor-pointer items-center justify-center rounded-full bg-[#253c32]/60 text-2xl text-[#fffaf0] focus-visible:outline-2 focus-visible:outline-[#fffaf0]"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          ref={menu}
          role="menu"
          tabIndex={-1}
          data-no-scene-swipe
          aria-label="Reel actions"
          className="absolute top-14 right-3 z-30 rounded bg-[#fffaf0] p-1 text-[#85513e] shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={deleting}
            onClick={() => {
              closeMenu();
              onDelete();
            }}
            className="min-h-11 cursor-pointer rounded px-4 text-[17px] focus-visible:outline-2 focus-visible:outline-[#85513e] disabled:opacity-50"
          >
            Move to photobook
          </button>
        </div>
      )}
    </figure>
  );
}
