"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PaperTexture } from "./paper-art";

const subscribe = () => () => {};

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  placement?: "center" | "side";
}

export function Modal({
  title,
  onClose,
  children,
  placement = "center",
}: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  useLayoutEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    if (!mounted) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ].filter((element) => element.getClientRects().length > 0);
    (
      dialog.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      focusable()[0]
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex ${placement === "side" ? "justify-end" : "items-center justify-center p-4"}`}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#394b38]/35 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialog}
        className={`relative isolate w-full overflow-y-auto bg-[#f7f2e7] p-6 text-[#394b38] shadow-[0_12px_60px_#394b3825] ${placement === "side" ? "h-svh max-w-[380px] border-l border-[#829070]/30 sm:p-8" : "max-h-[90svh] max-w-md rounded-[7px_15px_8px_12px] border border-[#829070]/30"}`}
      >
        <PaperTexture />
        <div className="relative mb-5 flex items-start justify-between gap-4 border-b border-[#829070]/25 pb-3">
          <h2 className="text-[28px] leading-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-2 flex size-11 shrink-0 cursor-pointer items-center justify-center text-[28px] text-[#65705a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42583d]"
          >
            x
          </button>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
