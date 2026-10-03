"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useHomeSound } from "../sound/home-sound";
import { playFridgeClose } from "./fridge-close-sound";

gsap.registerPlugin(useGSAP);

export function useFridgeEntrance() {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<"pending" | "animated" | "static">(
    "pending",
  );
  const sound = useHomeSound();
  const latestSound = useRef(sound);
  useLayoutEffect(() => {
    latestSound.current = sound;
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
      let stopSound: (() => void) | undefined;
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
          turn = gsap
            .timeline({ onComplete: finish })
            .to(
              door,
              { rotationY: 0, duration: 1.15, ease: "power2.inOut" },
              0.08,
            )
            .call(
              () => {
                const audio = latestSound.current;
                if (
                  audio.enabled &&
                  audio.context?.state === "running" &&
                  !document.hidden
                )
                  stopSound = playFridgeClose(audio.context);
              },
              [],
              1.18,
            );
          return () => {
            turn?.kill();
            stopSound?.();
            finish();
          };
        },
      );
      const onHidden = () => {
        if (document.hidden) {
          turn?.kill();
          stopSound?.();
          finish();
        }
      };
      document.addEventListener("visibilitychange", onHidden);
      const onResize = () => {
        turn?.kill();
        stopSound?.();
        finish();
      };
      window.addEventListener("resize", onResize);
      return () => {
        document.removeEventListener("visibilitychange", onHidden);
        window.removeEventListener("resize", onResize);
        media.revert();
        stopSound?.();
      };
    },
    { scope: root, dependencies: [ready], revertOnUpdate: true },
  );
  return { root, onReady };
}
