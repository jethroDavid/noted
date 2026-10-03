"use client";

import { useGSAP } from "@gsap/react";
import type { MemoryMotion } from "@noted/ui/memory-portal";
import { PaperTexture } from "@noted/ui/src";
import gsap from "gsap";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

gsap.registerPlugin(useGSAP);
const artwork = "/scene/sunday/morning-memory.webp";
const MemoryPortal = dynamic(() => import("@noted/ui/memory-portal"), {
  ssr: false,
});

class MemoryBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LoginScene({
  children,
  entering = false,
  onEntered,
}: {
  children: ReactNode;
  entering?: boolean;
  onEntered: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const renderFrame = useRef<(() => void) | null>(null);
  const motion = useRef<MemoryMotion>({
    reveal: 0,
    pull: 0,
    time: 0,
    pointerX: 0,
    pointerY: 0,
  });
  const [renderer, setRenderer] = useState<"pending" | "animated" | "fallback">(
    "pending",
  );
  const [fallbackImageReady, setFallbackImageReady] = useState(false);
  const onReady = useCallback((render: (() => void) | null) => {
    renderFrame.current = render;
    setRenderer(render ? "animated" : "pending");
    render?.();
  }, []);
  const onFailure = useCallback(() => {
    renderFrame.current = null;
    setRenderer("fallback");
  }, []);
  const shaderReady = renderer === "animated";
  const backgroundReady = renderer !== "pending";

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          standard: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const reduced = Boolean(context.conditions?.reduced);
          if (reduced) {
            motion.current.pull = 0;
            renderFrame.current?.();
            return;
          }
          gsap.from(".login-brand, .login-copy", {
            opacity: 0,
            y: 8,
            duration: 1.1,
            stagger: 0.12,
            ease: "power2.out",
          });
          gsap.fromTo(
            ".login-ink-draw",
            { strokeDasharray: 1, strokeDashoffset: 1 },
            {
              strokeDashoffset: 0,
              duration: 1.4,
              stagger: 0.12,
              ease: "power2.out",
            },
          );
          const x = gsap.quickTo(motion.current, "pointerX", {
            duration: 1.4,
            ease: "power3.out",
          });
          const y = gsap.quickTo(motion.current, "pointerY", {
            duration: 1.4,
            ease: "power3.out",
          });
          const surface = root.current;
          const move = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" || !surface) return;
            const bounds = surface.getBoundingClientRect();
            x(((event.clientX - bounds.left) / bounds.width) * 2 - 1);
            y(1 - ((event.clientY - bounds.top) / bounds.height) * 2);
          };
          const leave = () => {
            x(0);
            y(0);
          };
          let lastFrame = 0;
          const tick = (time: number) => {
            const frameRate = window.innerWidth < 640 ? 24 : 30;
            if (
              document.visibilityState !== "visible" ||
              time - lastFrame < 1 / frameRate
            )
              return;
            lastFrame = time;
            motion.current.time = time;
            renderFrame.current?.();
          };
          gsap.ticker.add(tick);
          surface?.addEventListener("pointermove", move);
          surface?.addEventListener("pointerleave", leave);
          return () => {
            gsap.ticker.remove(tick);
            surface?.removeEventListener("pointermove", move);
            surface?.removeEventListener("pointerleave", leave);
          };
        },
      );
      return () => media.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      motion.current.reveal = 0;
      if (!shaderReady) return;
      const media = gsap.matchMedia();
      media.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          standard: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (context.conditions?.reduced) {
            motion.current.reveal = 1;
            renderFrame.current?.();
            return;
          }
          gsap.fromTo(
            motion.current,
            { reveal: 0 },
            {
              reveal: 1,
              duration: 2.6,
              ease: "power2.out",
              onUpdate: () => renderFrame.current?.(),
            },
          );
        },
      );
      return () => media.revert();
    },
    { scope: root, dependencies: [shaderReady], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (!entering) return;
      const media = gsap.matchMedia();
      media.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          standard: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (context.conditions?.reduced) {
            onEntered();
            return;
          }
          if (!backgroundReady) return;
          gsap
            .timeline({ onComplete: onEntered })
            .to(
              motion.current,
              { pull: 1, duration: 2.7, ease: "power2.inOut" },
              0,
            )
            .to(
              ".login-memory",
              { scale: 1.65, duration: 2.7, ease: "power2.inOut" },
              0,
            )
            .to(
              ".login-invitation",
              { autoAlpha: 0, scale: 0.94, duration: 0.65, ease: "power2.in" },
              0.12,
            )
            .to(".login-wordmark", { autoAlpha: 0, duration: 0.55 }, 0.12)
            .to(
              ".login-memory",
              { opacity: 0, duration: 0.65, ease: "sine.inOut" },
              2.05,
            );
        },
      );
      return () => media.revert();
    },
    {
      scope: root,
      dependencies: [entering, onEntered, backgroundReady],
      revertOnUpdate: true,
    },
  );

  return (
    <main
      ref={root}
      aria-busy={entering}
      className="login-scene relative isolate flex min-h-svh flex-col items-center overflow-hidden bg-[#f7f2e7] px-5 pb-[max(3.5rem,env(safe-area-inset-bottom))] text-[#394b38] selection:bg-[#c8d3b4]"
    >
      <PaperTexture />
      <header className="login-wordmark relative z-10 mt-[max(2.5rem,env(safe-area-inset-top))] flex flex-col items-center text-center sm:mt-12">
        <div className="login-brand relative -rotate-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 60 60"
            className="absolute -top-1 -right-2 w-10 text-[#ba995b] sm:-right-12 sm:w-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path
              className="login-ink-draw"
              pathLength="1"
              d="M39 29 C40 39 31 44 23 39 C15 35 16 24 23 20 C32 14 41 22 39 29Z"
            />
            <path
              className="login-ink-draw"
              pathLength="1"
              d="M28 9 L29 3 M43 14 L48 9 M47 29 L55 28 M43 42 L48 48 M28 47 L27 54 M14 43 L8 48 M10 29 L3 28 M14 15 L8 9"
            />
          </svg>
          <h1 className="text-[clamp(5rem,10vw,7.5rem)] leading-[1.05] font-bold tracking-[-0.065em]">
            noted<span className="text-[#7e9066]">.</span>
          </h1>
          <svg
            aria-hidden="true"
            viewBox="0 0 200 14"
            className="-mt-1 ml-3 w-[85%] text-[#92a179]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path
              className="login-ink-draw"
              pathLength="1"
              d="M4 7 C54 3 122 10 194 4 M24 12 C66 9 122 12 161 9"
            />
          </svg>
        </div>
        <p className="login-copy mt-3 text-[18px] sm:text-[20px]">
          Make Yourself at Home
        </p>
      </header>
      <section
        aria-label="Sign in to Noted"
        className="login-threshold relative my-auto flex min-h-[min(350px,calc(100svh-240px))] w-full max-w-[960px] items-center justify-center py-12 sm:min-h-[480px]"
      >
        <div
          className="login-memory pointer-events-none absolute"
          aria-hidden="true"
          data-memory-display={renderer}
          data-fallback-ready={fallbackImageReady}
        >
          <div className="login-memory-fallback absolute inset-0">
            <Image
              src={artwork}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover"
              onLoad={() => setFallbackImageReady(true)}
            />
          </div>
          <div className="login-memory-canvas absolute inset-0">
            <MemoryBoundary onFailure={onFailure}>
              <MemoryPortal
                imageSrc={artwork}
                motion={motion}
                onReady={onReady}
                onUnavailable={onFailure}
              />
            </MemoryBoundary>
          </div>
        </div>
        <div className="login-invitation relative z-10 flex w-full max-w-[360px] flex-col items-center text-center">
          {children}
        </div>
      </section>
    </main>
  );
}
