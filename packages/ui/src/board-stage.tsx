"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface BoardStageProps {
  children: ReactNode;
  backdropSrc?: string;
  surfaceSrc?: string;
}

// The framed stage every scene renders inside: fixed kitchen backdrop plus
// the fridge surface notes stick to. Flat gradients backstop failed art.
export function BoardStage({
  children,
  backdropSrc = "/scene/backdrop.webp",
  surfaceSrc = "/scene/surface.webp",
}: BoardStageProps) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [surfaceFailed, setSurfaceFailed] = useState(false);

  return (
    <section
      aria-label="Board stage"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900"
    >
      {backdropFailed ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-900"
        />
      ) : (
        <img
          src={backdropSrc}
          alt=""
          aria-hidden
          onError={() => setBackdropFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative aspect-[7/10] h-[min(92vh,130vw)] max-h-[940px]">
        {surfaceFailed ? (
          <div
            aria-hidden
            className="absolute inset-0 rounded-xl bg-amber-50 shadow-2xl"
          />
        ) : (
          <img
            src={surfaceSrc}
            alt="Fridge door"
            onError={() => setSurfaceFailed(true)}
            className="absolute inset-0 h-full w-full rounded-xl object-cover shadow-2xl"
          />
        )}
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
