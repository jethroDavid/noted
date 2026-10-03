"use client";

export function ConnectionPill({
  status,
}: {
  status: "idle" | "connecting" | "pending" | "error";
}) {
  if (status === "idle") return null;
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1.5 py-1 text-[15px] text-[#65705a]">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[#829070]" />
        Live
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 py-1 text-[15px] text-[#65705a]">
        <span
          aria-hidden
          className="h-2 w-2 animate-pulse rounded-full bg-[#b69a61] motion-reduce:animate-none"
        />
        Connecting…
      </span>
    );
  }
  return (
    <span
      title="Shared updates are paused. They resume automatically when the stream reconnects."
      className="flex items-center gap-1.5 py-1 text-[15px] text-[#65705a]"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-[#a7684e]" />
      Offline — updates paused
    </span>
  );
}
