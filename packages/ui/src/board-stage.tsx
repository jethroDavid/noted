"use client";

import { useEffect, useId, useState } from "react";
import type { ReactNode, RefObject } from "react";

interface BoardStageProps {
  children: ReactNode;
  backdrop: ReactNode;
  surfaceSrc: string;
  interiorSrc: string;
  stageRef: RefObject<HTMLDivElement | null>;
  onReady: (animate: boolean) => void;
}

// The art is bounded by a soft memory edge; post coordinates stay relative
// to the same normalized fridge surface at every viewport size.
export function BoardStage({
  children,
  backdrop,
  surfaceSrc,
  interiorSrc,
  stageRef,
  onReady,
}: BoardStageProps) {
  const id = useId().replaceAll(":", "");
  const apertureId = `fridge-aperture-${id}`;
  const casingId = `fridge-casing-${id}`;
  // The same opening cuts the fixed casing and bounds both interior and face.
  const aperture =
    "M.089 .067H.88Q.94 .067 .94 .127V.882Q.94 .942 .88 .942H.089Q.029 .942 .029 .882V.127Q.029 .067 .089 .067Z";
  const [surfaceFailed, setSurfaceFailed] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [interiorReady, setInteriorReady] = useState(false);
  const [interiorFailed, setInteriorFailed] = useState(false);
  const ready =
    (surfaceReady || surfaceFailed) && (interiorReady || interiorFailed);
  useEffect(() => {
    if (ready) onReady(!surfaceFailed && !interiorFailed);
  }, [ready, surfaceFailed, interiorFailed, onReady]);

  return (
    <section
      aria-label="Fridge board"
      className="relative isolate mx-auto flex h-full w-full items-center justify-center"
    >
      {backdrop}
      <div
        ref={stageRef}
        className={`home-fridge relative aspect-[3/5] h-[min(88%,calc((100vw_-_48px)*5/3))] max-h-[810px] transition-opacity duration-700 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <svg
          role="img"
          aria-label="Cream enamel fridge"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <clipPath id={apertureId} clipPathUnits="objectBoundingBox">
              <path d={aperture} />
            </clipPath>
            <mask
              id={casingId}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="100"
              height="100"
            >
              <rect width="100" height="100" fill="white" />
              <path d={aperture} transform="scale(100)" fill="black" />
            </mask>
          </defs>
          {surfaceFailed ? (
            <rect
              x="3"
              y="6"
              width="94"
              height="90"
              rx="7"
              fill="#eee8cc"
              stroke="#b5b593"
            />
          ) : (
            <image
              href={surfaceSrc}
              width="100"
              height="100"
              preserveAspectRatio="none"
              mask={`url(#${casingId})`}
              onLoad={() => setSurfaceReady(true)}
              onError={() => setSurfaceFailed(true)}
            />
          )}
        </svg>
        <img
          src={interiorSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          onLoad={() => setInteriorReady(true)}
          onError={() => setInteriorFailed(true)}
          style={{ clipPath: `url(#${apertureId})` }}
          className={`home-fridge-interior pointer-events-none absolute inset-0 h-full w-full ${interiorFailed || surfaceFailed ? "invisible" : ""}`}
        />
        <div className="home-fridge-door absolute inset-0">
          {!surfaceFailed && (
            <img
              src={surfaceSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ clipPath: `url(#${apertureId})` }}
              className="home-fridge-door-art pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          <div
            data-board-surface
            className="[container-type:size] absolute top-[8%] right-[12%] bottom-[7%] left-[6%]"
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
