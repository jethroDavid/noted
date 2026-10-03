"use client";

import { useId } from "react";

export function PaperTexture() {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.055] mix-blend-multiply"
    >
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.75"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

export function PaperButtonArtwork({
  outlineClassName,
}: {
  outlineClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_4px_2px_#70775325]"
    >
      <path
        className={outlineClassName}
        d="M14 7 C72 2 189 7 266 4 Q278 5 277 18 L275 45 Q274 56 261 56 C189 60 86 55 16 59 Q4 58 5 46 L6 19 Q4 9 14 7Z"
        fill="#fffaf0"
        stroke="#829070"
        strokeWidth="1.3"
      />
      <path
        d="M20 11 C92 7 192 12 262 9 M18 54 C92 51 184 57 259 52"
        fill="none"
        stroke="#b4bb98"
        strokeWidth="0.7"
        opacity="0.55"
      />
    </svg>
  );
}
