"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useHomeSound } from "../sound/home-sound";
import { loadFridgeGlass, playFridgeClose } from "./fridge-close-sound";

gsap.registerPlugin(useGSAP);

export function useFridgeEntrance() {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<"pending" | "animated" | "static">(
    "pending",
  );
  const sound = useHomeSound();
  const stopSound = useRef<(() => void) | null>(null);
  const glass = useRef<AudioBuffer | null>(null);
  useEffect(() => {
    if (!sound.context) return;
    let cancelled = false;
    void loadFridgeGlass(sound.context).then((buffer) => {
      if (!cancelled) glass.current = buffer;
    });
    return () => {
      cancelled = true;
      glass.current = null;
    };
  }, [sound.context]);
  const latestSound = useRef(sound);
  useLayoutEffect(() => {
    latestSound.current = sound;
    if (!sound.enabled) stopSound.current?.();
  }, [sound]);
  const onReady = useCallback(
    (animate: boolean) => setReady(animate ? "animated" : "static"),
    [],
  );
  useGSAP(
    () => {
      if (ready === "pending") return;
      const surface = root.current;
      if (!surface) return;
      const door = surface.querySelector<HTMLElement>(".home-fridge-door");
      if (!door) return;
      const media = gsap.matchMedia();
      const finish = () => {
        gsap.set(door, { clearProps: "transform,filter,pointerEvents" });
        surface.dataset.fridgeClosed = "true";
      };
      let turn: gsap.core.Timeline | undefined;
      media.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          standard: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (
            ctx.conditions?.reduced ||
            ready === "static" ||
            document.hidden
          ) {
            finish();
            return;
          }
          surface.dataset.fridgeClosed = "false";
          gsap.set(door, { rotationY: -38, pointerEvents: "none" });
          turn = gsap.timeline().to(
            door,
            {
              rotationY: 0,
              duration: 1.15,
              // Keep moving into contact instead of easing to an almost-closed
              // standstill before the seal sound. The tween owns the cue.
              ease: "power2.in",
              onComplete: () => {
                finish();
                const audio = latestSound.current;
                if (
                  audio.enabled &&
                  audio.context?.state === "running" &&
                  !document.hidden
                )
                  stopSound.current = playFridgeClose(
                    audio.context,
                    glass.current,
                  );
              },
            },
            0.08,
          );
          return () => {
            turn?.kill();
            stopSound.current?.();
            finish();
          };
        },
      );
      const onHidden = () => {
        if (document.hidden) {
          turn?.kill();
          stopSound.current?.();
          finish();
        }
      };
      document.addEventListener("visibilitychange", onHidden);
      const onResize = () => {
        turn?.kill();
        stopSound.current?.();
        finish();
      };
      window.addEventListener("resize", onResize);
      return () => {
        document.removeEventListener("visibilitychange", onHidden);
        window.removeEventListener("resize", onResize);
        media.revert();
        stopSound.current?.();
      };
    },
    { scope: root, dependencies: [ready], revertOnUpdate: true },
  );
  return { root, onReady };
}
