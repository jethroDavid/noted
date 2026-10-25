"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

gsap.registerPlugin(useGSAP);

// The login button and home links share the same soft paper response.
export function usePaperMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", (context) => {
        const surface = root.current;
        if (!surface) return;
        const paper = surface.querySelector(".paper-outline");
        const restOutline = paper?.getAttribute("d");
        const restRotation = Number(gsap.getProperty(surface, "rotation"));
        const disabled = () =>
          surface instanceof HTMLButtonElement && surface.disabled;
        const float = context.add("float", () => {
          if (disabled()) return;
          gsap.to(surface, {
            y: -3,
            rotation: restRotation + 1.2,
            scale: 1.025,
            duration: 0.65,
            ease: "elastic.out(1, 0.6)",
            overwrite: "auto",
          });
          gsap.to(paper ?? [], {
            attr: {
              d: "M14 7 C72 10 189 0 266 4 Q278 5 277 18 L275 45 Q274 56 261 56 C189 52 86 63 16 59 Q4 58 5 46 L6 19 Q4 9 14 7Z",
            },
            duration: 0.75,
            ease: "sine.inOut",
            overwrite: "auto",
          });
        });
        const settle = context.add("settle", () => {
          gsap.to(surface, {
            y: 0,
            rotation: restRotation,
            scale: 1,
            duration: 0.8,
            ease: "elastic.out(1, 0.7)",
            overwrite: "auto",
          });
          if (restOutline)
            gsap.to(paper ?? [], {
              attr: { d: restOutline },
              duration: 0.8,
              ease: "sine.inOut",
              overwrite: "auto",
            });
        });
        const press = context.add("press", () => {
          if (disabled()) return;
          gsap.to(surface, {
            y: 1,
            scale: 0.975,
            rotation: restRotation + 0.4,
            duration: 0.15,
            overwrite: "auto",
          });
        });
        const events = [
          ["pointerenter", () => float()],
          ["pointerleave", () => settle()],
          ["focus", () => float()],
          ["blur", () => settle()],
          ["pointerdown", () => press()],
          ["pointerup", () => settle()],
          ["pointercancel", () => settle()],
        ] as const;
        for (const [event, listener] of events)
          surface.addEventListener(event, listener);
        return () => {
          for (const [event, listener] of events)
            surface.removeEventListener(event, listener);
        };
      });
      return () => media.revert();
    },
    { scope: root },
  );
}
