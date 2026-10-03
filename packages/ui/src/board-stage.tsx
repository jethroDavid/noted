"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface BoardStageProps {
  children: ReactNode;
  backdropSrc?: string;
  surfaceSrc?: string;
}

// The art is bounded by a soft memory edge; post coordinates stay relative
// to the same 7:10 fridge surface at every viewport size.
export function BoardStage({
  children,
  backdropSrc = "/scene/backdrop.webp",
  surfaceSrc = "/scene/surface.webp",
}: BoardStageProps) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [surfaceFailed, setSurfaceFailed] = useState(false);

  return (
    <section
      aria-label="Fridge board"
      className="relative isolate mx-auto flex h-full w-full items-center justify-center"
    >
      {backdropFailed ? (
        <div
          aria-hidden
          className="home-room-memory absolute inset-0 bg-[#e2deca]"
        />
      ) : (
        <img
          src={backdropSrc}
          draggable={false}
          alt=""
          aria-hidden
          onError={() => setBackdropFailed(true)}
          className="home-room-memory pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
        />
      )}
      <div className="relative aspect-[7/10] h-[min(100%,calc((100vw_-_24px)*10/7))] drop-shadow-[3px_12px_8px_#68674a30]">
        {surfaceFailed ? (
          <div
            aria-hidden
            className="absolute inset-0 rounded-xl border border-[#b5b593] bg-[#eee8cc]"
          />
        ) : (
          <img
            src={surfaceSrc}
            draggable={false}
            alt="Fridge door"
            onError={() => setSurfaceFailed(true)}
            className="absolute inset-0 h-full w-full rounded-xl object-cover"
          />
        )}
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
