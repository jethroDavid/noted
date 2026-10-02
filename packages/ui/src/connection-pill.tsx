"use client";

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
