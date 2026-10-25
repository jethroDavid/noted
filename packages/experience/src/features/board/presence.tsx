"use client";

import type { BoardViewer } from "@noted/validators/src";

function viewerColor(email: string): string {
  let hash = 0;
  for (let index = 0; index < email.length; index += 1) {
    hash = (hash * 31 + email.charCodeAt(index)) % 360;
  }
  return `hsl(${hash}, 55%, 42%)`;
}

function viewerLabel(viewer: BoardViewer): string {
  return viewer.displayName ?? viewer.email;
}

export function ViewersRow({
  viewers,
  ownEmail,
}: {
  viewers: BoardViewer[];
  ownEmail: string;
}) {
  if (viewers.length === 0) return null;
  const names = viewers.map((viewer) =>
    viewer.email === ownEmail
      ? `${viewerLabel(viewer)} (you)`
      : viewerLabel(viewer),
  );
  return (
    <span
      aria-label={`Viewing now: ${names.join(", ")}`}
      className="flex items-center"
    >
      {viewers.map((viewer) => (
        <span
          key={viewer.userId}
          title={
            viewer.email === ownEmail
              ? `${viewerLabel(viewer)} (you)`
              : viewerLabel(viewer)
          }
          aria-hidden
          className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white first:ml-0"
          style={{ backgroundColor: viewerColor(viewer.email) }}
        >
          {(viewerLabel(viewer).charAt(0) || "?").toUpperCase()}
        </span>
      ))}
    </span>
  );
}
