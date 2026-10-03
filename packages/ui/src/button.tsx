"use client";

import type { ComponentProps } from "react";
import { PaperButtonArtwork } from "./paper-art";

export function Button({
  children,
  className = "",
  variant = "paper",
  ...props
}: ComponentProps<"button"> & { variant?: "paper" | "quiet" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={`relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-[17px] leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] disabled:cursor-not-allowed disabled:opacity-50 ${variant === "danger" ? "rounded-[5px_9px_4px_7px] bg-[#85513e] text-[#fffaf0]" : "text-[#394b38]"} ${className}`}
    >
      {variant === "paper" && (
        <PaperButtonArtwork outlineClassName="paper-outline" />
      )}
      <span
        className={`relative ${variant === "quiet" ? "underline decoration-[#829070]/40 underline-offset-4" : ""}`}
      >
        {children}
      </span>
    </button>
  );
}
