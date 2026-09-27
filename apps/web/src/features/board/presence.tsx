import type { BoardViewer } from "@noted/validators/src";

export function ConnectionPill({
  status,
}: {
  status: "idle" | "connecting" | "pending" | "error";
}) {
  if (status === "idle") return null;
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
        <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
        Live
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
        <span
          aria-hidden
          className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
        />
        Connecting…
      </span>
    );
  }
  return (
    <span
      title="Shared updates are paused. They resume automatically when the stream reconnects."
      className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-red-500" />
      Offline — updates paused
    </span>
  );
}

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
