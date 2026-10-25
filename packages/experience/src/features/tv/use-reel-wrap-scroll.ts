"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

// Keep one finite list. Only a fresh gesture at an end wraps it, so the
// momentum that arrives on the last clip doesn't immediately skip that clip.
export function useReelWrapScroll(
  viewport: RefObject<HTMLDivElement | null>,
  count: number,
) {
  const navigate = useRef<(index: number, direction: number) => void>(() => {});
  const settleWrap = useRef<() => boolean>(() => false);
  useEffect(() => {
    const element = viewport.current;
    if (!element || count < 2) return;
    const edge = (direction: number) =>
      direction > 0
        ? element.scrollHeight - element.clientHeight - element.scrollTop < 2
        : element.scrollTop < 2;
    let transition: { tween: gsap.core.Tween; finish: () => void } | null =
      null;
    const scrollToClip = (index: number, direction: number) => {
      if (transition) return;
      const clips = element.querySelectorAll<HTMLElement>("[data-reel-id]");
      const target = clips[index];
      if (!target) return;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const wraps =
        direction > 0
          ? target.offsetTop < element.scrollTop
          : target.offsetTop > element.scrollTop;
      if (reduced || !wraps) {
        element.scrollTo({
          top: target.offsetTop,
          behavior: reduced ? "instant" : "smooth",
        });
        return;
      }

      // Move the actual destination into a temporary adjacent slot. No cloned
      // videos: native scrolling still drives visibility, playback and focus.
      const height = element.clientHeight;
      const listHeight = element.scrollHeight;
      const targetTop = target.offsetTop;
      const start = element.scrollTop;
      const snap = element.style.scrollSnapType;
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.dataset.reelWrapSpacer = "";
      spacer.style.height = `${height}px`;
      element.style.scrollSnapType = "none";
      if (direction > 0) element.append(spacer);
      else element.prepend(spacer);
      gsap.set(target, {
        y: direction > 0 ? listHeight - targetTop : -targetTop - height,
      });
      element.scrollTop = direction > 0 ? start : start + height;
      const finish = () => {
        gsap.set(target, { clearProps: "transform" });
        spacer.remove();
        if (target.isConnected)
          element.scrollTo({ top: target.offsetTop, behavior: "instant" });
        element.style.scrollSnapType = snap;
        transition = null;
      };
      const tween = gsap.to(element, {
        scrollTop: direction > 0 ? listHeight : 0,
        duration: 0.42,
        ease: "power2.inOut",
        onComplete: finish,
      });
      transition = { tween, finish };
    };
    navigate.current = scrollToClip;
    const wrap = (direction: number) =>
      scrollToClip(direction > 0 ? 0 : count - 1, direction);
    const inMenu = (event: Event) =>
      (event.target as Element).closest('[role="menu"]');
    let lastWheel = -Infinity;
    let wheelDirection = 0;
    let wheelBoundary = false;
    let wheelWrapped = false;
    let wheelDistance = 0;
    const wheel = (event: WheelEvent) => {
      if (inMenu(event) || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
        return;
      if (transition) {
        event.preventDefault();
        lastWheel = event.timeStamp;
        return;
      }
      const direction = Math.sign(event.deltaY);
      if (event.timeStamp - lastWheel > 220 || direction !== wheelDirection) {
        wheelBoundary = edge(direction);
        wheelWrapped = false;
        wheelDistance = 0;
      }
      lastWheel = event.timeStamp;
      wheelDirection = direction;
      if (!wheelBoundary) return;
      event.preventDefault();
      wheelDistance +=
        Math.abs(event.deltaY) *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1);
      if (!wheelWrapped && wheelDistance >= 24) {
        wheelWrapped = true;
        wrap(direction);
      }
    };
    let touch: {
      x: number;
      y: number;
      top: boolean;
      bottom: boolean;
      wrapped: boolean;
    } | null = null;
    const touchStart = (event: TouchEvent) => {
      touch = null;
      const start = event.touches[0];
      if (event.touches.length !== 1 || !start || inMenu(event)) return;
      touch = {
        x: start.clientX,
        y: start.clientY,
        top: edge(-1),
        bottom: edge(1),
        wrapped: false,
      };
    };
    const touchMove = (event: TouchEvent) => {
      const position = event.touches[0];
      if (!touch || !position || event.touches.length !== 1) return;
      if (touch.wrapped || transition) {
        event.preventDefault();
        return;
      }
      const dy = touch.y - position.clientY;
      const dx = touch.x - position.clientX;
      if (Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx) * 1.4) return;
      if ((dy > 0 && touch.bottom) || (dy < 0 && touch.top)) {
        event.preventDefault();
        touch.wrapped = true;
        wrap(Math.sign(dy));
      }
    };
    const touchEnd = () => {
      touch = null;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (inMenu(event)) return;
      const direction =
        event.key === "ArrowDown" || event.key === "PageDown"
          ? 1
          : event.key === "ArrowUp" || event.key === "PageUp"
            ? -1
            : 0;
      if (!direction) return;
      if (transition) {
        event.preventDefault();
        return;
      }
      if (!edge(direction)) return;
      event.preventDefault();
      wrap(direction);
    };
    const settle = () => {
      if (!transition) return false;
      transition?.tween.kill();
      transition?.finish();
      return true;
    };
    settleWrap.current = settle;
    const visibility = () => {
      if (document.visibilityState !== "visible") settle();
    };
    document.addEventListener("visibilitychange", visibility);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", touchEnd);
    element.addEventListener("touchcancel", touchEnd);
    element.addEventListener("keydown", keyDown);
    return () => {
      settle();
      navigate.current = () => {};
      settleWrap.current = () => false;
      document.removeEventListener("visibilitychange", visibility);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", touchEnd);
      element.removeEventListener("touchcancel", touchEnd);
      element.removeEventListener("keydown", keyDown);
    };
  }, [viewport, count]);
  const scrollToClip = useCallback(
    (index: number, direction = 1) => navigate.current(index, direction),
    [],
  );
  const settle = useCallback(() => settleWrap.current(), []);
  return { scrollToClip, settle };
}
