"use client";

import type { ButtonHTMLAttributes } from "react";

// Skeleton primitive proving the ui package wires into the app.
// Real board components land in Phase 1.
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded bg-slate-900 px-4 py-2 text-white ${props.className ?? ""}`}
    />
  );
}
