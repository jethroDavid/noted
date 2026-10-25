"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useTvFullscreen(surface: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  function close() {
    if (document.fullscreenElement === surface.current)
      void document.exitFullscreen().catch(() => {});
    setActive(false);
  }
  function toggle() {
    if (active) {
      close();
      return;
    }
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActive(true);
    // Phones keep their portrait viewport; desktop may also hide browser chrome.
    if (!matchMedia("(max-width: 639px)").matches)
      void surface.current?.requestFullscreen?.().catch(() => {});
  }
  useEffect(() => {
    const changed = () =>
      setActive(document.fullscreenElement === surface.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [surface]);
  useEffect(() => {
    if (!active) {
      opener.current?.focus();
      return;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    surface.current
      ?.querySelector<HTMLElement>("[data-fullscreen-control]")
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (document.fullscreenElement === surface.current)
          void document.exitFullscreen().catch(() => {});
        setActive(false);
      }
      if (event.key !== "Tab") return;
      const bounds = surface.current?.getBoundingClientRect();
      const buttons = [
        ...(surface.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled)",
        ) ?? []),
      ].filter((button) => {
        const rect = button.getBoundingClientRect();
        return (
          bounds &&
          rect.bottom > bounds.top &&
          rect.top < bounds.bottom &&
          rect.width > 0
        );
      });
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", key);
    };
  }, [active, surface]);
  useEffect(
    () => () => {
      if (document.fullscreenElement === surface.current)
        void document.exitFullscreen().catch(() => {});
    },
    [surface],
  );
  return { active, toggle };
}
