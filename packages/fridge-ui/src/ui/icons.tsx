import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
}: {
  name:
    | "note"
    | "photo"
    | "voice"
    | "close"
    | "plus"
    | "home"
    | "arrow"
    | "help"
    | "palette";
  size?: number;
}) {
  const paths = {
    palette: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18h1a2.2 2.2 0 0 0 1.5-3.8 1.5 1.5 0 0 1 1-2.6H18a3 3 0 0 0 3-3C21 6.8 17 3 12 3Z" />
        <circle cx="7.5" cy="10" r="1" />
        <circle cx="11" cy="6.8" r="1" />
        <circle cx="16" cy="8" r="1" />
      </>
    ),
    note: (
      <>
        <path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9Z" />
        <path d="M14 3v7h7M7 14h9M7 17h6" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </>
    ),
    voice: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .6-1.7 1.2-1.7 2.7M12 17h.01" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Waveform() {
  return (
    <span className="waveform" aria-hidden="true">
      {[
        12, 20, 14, 28, 36, 20, 30, 44, 32, 22, 38, 26, 16, 30, 42, 28, 18, 34,
        24, 12, 20, 14,
      ].map((height, index) => (
        <i
          key={index}
          style={{ "--bar-height": `${height}px` } as CSSProperties}
        />
      ))}
    </span>
  );
}
