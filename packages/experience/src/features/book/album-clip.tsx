"use client";

import type { BookEntry } from "@noted/validators/src";
import { useEffect, useRef, useState } from "react";

export function AlbumClip({
  entry,
  enabled,
}: {
  entry: Extract<BookEntry, { kind: "clip" }>;
  enabled: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const surface = root.current;
    const clip = video.current;
    if (!surface || !clip) return;
    let visible = false;
    let attached = false;
    let alive = true;
    const release = () => {
      attached = false;
      clip.pause();
      clip.removeAttribute("src");
      clip.load();
    };
    const update = () => {
      if (!enabled || !visible || document.hidden) {
        if (attached) release();
        return;
      }
      if (attached) return;
      attached = true;
      clip.muted = true;
      clip.src = entry.videoUrl;
      void clip.play().catch(() => {
        if (alive) setPlaying(false);
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some(
          (item) => item.isIntersecting && item.intersectionRatio >= 0.15,
        );
        update();
      },
      { threshold: 0.15 },
    );
    observer.observe(surface);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      release();
    };
  }, [entry.videoUrl, enabled]);

  return (
    <span
      ref={root}
      className="relative isolate z-0 block min-h-0 w-full flex-1 overflow-hidden bg-[#e9e3d6]"
    >
      {entry.posterUrl ? (
        <img
          src={entry.posterUrl}
          draggable={false}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[#253c32] text-2xl text-[#fffaf0]"
        >
          ▷
        </span>
      )}
      <video
        ref={video}
        aria-hidden="true"
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        onEmptied={() => setPlaying(false)}
        onError={() => setPlaying(false)}
        className={`absolute inset-0 h-full w-full bg-[#e9e3d6] object-contain transition-opacity duration-200 motion-reduce:transition-none ${playing ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
