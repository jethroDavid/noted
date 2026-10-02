"use client";

interface SpinnerProps {
  label?: string;
  className?: string;
}

// Shared loading indicator for upload-backed media: non-ready photo posts
// and reels render this until their thumbnail or poster lands.
export function Spinner({ label = "Loading…", className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 ${className ?? ""}`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
