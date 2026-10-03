"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface BoardStageProps {
  children: ReactNode;
  backdrop: ReactNode;
  surfaceSrc: string;
}

// The art is bounded by a soft memory edge; post coordinates stay relative
// to the same normalized fridge surface at every viewport size.
export function BoardStage({
  children,
  backdrop,
  surfaceSrc,
}: BoardStageProps) {
  const [surfaceFailed, setSurfaceFailed] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);

  return (
    <section
      aria-label="Fridge board"
      className="relative isolate mx-auto flex h-full w-full items-center justify-center"
    >
      {backdrop}
      <div
        className={`home-fridge relative aspect-[3/5] h-[min(88%,calc((100vw_-_48px)*5/3))] max-h-[810px] transition-opacity duration-700 motion-reduce:transition-none ${surfaceReady || surfaceFailed ? "opacity-100" : "opacity-0"}`}
      >
        {surfaceFailed ? (
          <div
            aria-hidden
            className="absolute inset-0 rounded-[7%] border border-[#b5b593] bg-[#eee8cc]"
          />
        ) : (
          <img
            src={surfaceSrc}
            draggable={false}
            alt="Cream enamel fridge"
            onLoad={() => setSurfaceReady(true)}
            onError={() => setSurfaceFailed(true)}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
        <div
          data-board-surface
          className="[container-type:size] absolute top-[8%] right-[12%] bottom-[7%] left-[6%]"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
