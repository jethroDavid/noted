"use client";

import { useEffect, useRef } from "react";

export function VhsTexture({ channel }: { channel: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d", { alpha: true });
    if (!surface || !context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pixels = context.createImageData(surface.width, surface.height);
    const draw = () => {
      if (document.visibilityState !== "visible") return;
      for (let i = 0; i < pixels.data.length; i += 4) {
        const grain = Math.random() * 255;
        pixels.data[i] = grain;
        pixels.data[i + 1] = grain;
        pixels.data[i + 2] = grain;
        pixels.data[i + 3] = 35;
      }
      context.putImageData(pixels, 0, 0);
    };
    draw();
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (!reduced.matches) timer = setInterval(draw, 1000 / 12);
    };
    update();
    reduced.addEventListener("change", update);
    return () => {
      clearInterval(timer);
      reduced.removeEventListener("change", update);
    };
  }, []);
  return (
    <div
      className="home-vhs pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <svg className="absolute size-0" focusable="false">
        <defs>
          <filter id="home-vhs-color" colorInterpolationFilters="sRGB">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="0.32"
              result="soft"
            />
            <feColorMatrix
              in="soft"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="red"
            />
            <feOffset in="red" dx="-0.8" result="redShift" />
            <feColorMatrix
              in="soft"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="cyan"
            />
            <feOffset in="cyan" dx="0.8" result="cyanShift" />
            <feBlend in="redShift" in2="cyanShift" mode="screen" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvas}
        width={160}
        height={120}
        className="absolute inset-0 h-full w-full opacity-60 mix-blend-soft-light"
      />
      <div className="home-tv-fizz" />
      <div className="home-vhs-tracking" />
      <div key={channel} className="home-vhs-tune" />
    </div>
  );
}
