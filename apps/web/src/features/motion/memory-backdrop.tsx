"use client";

import { useGSAP } from "@gsap/react";
import type { MemoryMotion } from "@noted/ui/memory-portal";
import gsap from "gsap";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

gsap.registerPlugin(useGSAP);
const MemoryPortal = dynamic(() => import("@noted/ui/memory-portal"), {
  ssr: false,
});

class BackdropBoundary extends Component<
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

const narrowScreen = () => matchMedia("(max-width: 639px)").matches;
const serverScreen = () => false;
function subscribeScreen(changed: () => void) {
  const media = matchMedia("(max-width: 639px)");
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
}

// Art-directed phone composition; remount to wait for the new texture's first frame.
export function MemoryBackdrop({
  imageSrc,
  mobileImageSrc,
}: {
  imageSrc: string;
  mobileImageSrc?: string;
}) {
  const narrow = useSyncExternalStore(
    subscribeScreen,
    narrowScreen,
    serverScreen,
  );
  const source = narrow && mobileImageSrc ? mobileImageSrc : imageSrc;
  return <MemoryBackdropScene key={source} imageSrc={source} />;
}

// Reuse the liquid renderer, with a wider, quiet room silhouette.
function MemoryBackdropScene({ imageSrc }: { imageSrc: string }) {
  const root = useRef<HTMLDivElement>(null);
  const renderFrame = useRef<(() => void) | null>(null);
  const motion = useRef<MemoryMotion>({
    reveal: 0,
    pull: 0,
    time: 0,
    pointerX: 0,
    pointerY: 0,
  });
  const [display, setDisplay] = useState<"pending" | "animated" | "still">(
    "pending",
  );
  const onReady = useCallback((render: (() => void) | null) => {
    renderFrame.current = render;
    if (render) setDisplay("animated");
  }, []);
  const onFailure = useCallback(() => setDisplay("still"), []);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          standard: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (context.conditions?.reduced || display === "still") {
            gsap.set(root.current, { opacity: 1 });
            return;
          }
          if (display !== "animated") return;
          const reveal = gsap.to(motion.current, {
            reveal: 1,
            duration: 2.1,
            ease: "sine.out",
          });
          gsap.to(root.current, { opacity: 0.85, duration: 1.2 });
          let previous = 0;
          let elapsed = 0;
          const tick = (time: number, delta: number) => {
            if (document.visibilityState !== "visible") return;
            elapsed += Math.min(delta, 100) / 1000;
            if (time - previous < 1 / (innerWidth < 640 ? 24 : 30)) return;
            previous = time;
            motion.current.time = elapsed;
            renderFrame.current?.();
          };
          gsap.ticker.add(tick);
          return () => {
            reveal.kill();
            gsap.ticker.remove(tick);
          };
        },
      );
      return () => media.revert();
    },
    { scope: root, dependencies: [display], revertOnUpdate: true },
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-memory-display={display}
      className="home-tv-memory pointer-events-none absolute inset-0 opacity-0"
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        unoptimized
        className={`home-room-memory object-cover ${display === "still" ? "opacity-80" : "hidden motion-reduce:block"}`}
      />
      {display !== "still" && (
        <div className="absolute inset-0 motion-reduce:hidden">
          <BackdropBoundary onFailure={onFailure}>
            <MemoryPortal
              imageSrc={imageSrc}
              variant="room"
              motion={motion}
              onReady={onReady}
              onUnavailable={onFailure}
            />
          </BackdropBoundary>
        </div>
      )}
    </div>
  );
}
