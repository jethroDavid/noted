"use client";

import { useGSAP } from "@gsap/react";
import {
  Button,
  getAdjacentSceneIndex,
  getSceneSwipeStep,
  PaperTexture,
} from "@noted/ui/src";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { use, useRef, useState } from "react";
import { BoardView } from "../../../../features/board/board-view";
import { MembersPanel } from "../../../../features/board/members-panel";
import { BookView } from "../../../../features/book/book-view";
import { HomeSoundProvider } from "../../../../features/sound/home-sound";
import { ReelsView } from "../../../../features/tv/reels-view";
import { useAuth } from "../../../../platform/auth/auth-provider";
import { useTRPC } from "../../../../trpc/react";

gsap.registerPlugin(useGSAP);
type HomeTab = "fridge" | "tv" | "book";
const TABS: Array<{ id: HomeTab; label: string; time: string }> = [
  { id: "tv", label: "Television", time: "Morning" },
  { id: "fridge", label: "Fridge", time: "Afternoon" },
  { id: "book", label: "Photobook", time: "Night" },
];

function SceneEntrance({
  children,
  direction,
}: {
  children: ReactNode;
  direction: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root.current,
          { opacity: 0, x: direction * 24 },
          {
            opacity: 1,
            x: 0,
            duration: 0.55,
            ease: "power2.out",
            clearProps: "transform",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root },
  );
  return (
    <div
      ref={root}
      className="h-full min-h-0 opacity-0 motion-reduce:opacity-100"
    >
      {children}
    </div>
  );
}

export default function HomeDetailPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  return (
    <HomeSoundProvider>
      <HomeDetailContent params={params} />
    </HomeSoundProvider>
  );
}

function HomeDetailContent({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = use(params);
  const auth = useAuth();
  const trpc = useTRPC();
  const router = useRouter();
  const [membersOpen, setMembersOpen] = useState(false);
  const [tab, setTab] = useState<HomeTab>("tv");
  const [direction, setDirection] = useState(1);
  const swipe = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  function switchScene(step: -1 | 1) {
    setDirection(step);
    setTab(
      (current) =>
        TABS[
          getAdjacentSceneIndex(
            TABS.findIndex((scene) => scene.id === current),
            step,
            TABS.length,
          )
        ]!.id,
    );
  }
  const homeQuery = useQuery({
    ...trpc.homes.get.queryOptions({ homeId }),
    enabled: auth.status === "signed-in",
  });

  return (
    <main className="relative isolate h-svh overflow-hidden bg-[#f7f2e7] px-3 text-[#394b38] selection:bg-[#c8d3b4] sm:px-5">
      <PaperTexture />
      <div className="relative mx-auto flex h-full max-w-[1500px] flex-col">
        <header className="grid h-[60px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#829070]/20 sm:h-16 sm:gap-6">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center text-[15px] text-[#65705a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#42583d] sm:text-[17px]"
          >
            ← Your homes
          </Link>
          <h1
            className="truncate text-center text-[22px] leading-tight sm:text-[26px]"
            title={homeQuery.data?.home.name}
          >
            {homeQuery.data?.home.name ?? "Your home"}
          </h1>
          {auth.status === "signed-in" && homeQuery.data ? (
            <Button
              variant="quiet"
              onClick={() => setMembersOpen(true)}
              aria-expanded={membersOpen}
              className="px-1 text-[15px] sm:text-[17px]"
            >
              Members
            </Button>
          ) : (
            <span />
          )}
        </header>
        {auth.status === "loading" ||
        (auth.status === "signed-in" && homeQuery.isLoading) ? (
          <p role="status" className="py-20 text-center text-xl text-[#65705a]">
            Opening your home…
          </p>
        ) : auth.status !== "signed-in" ? (
          <div className="flex flex-col items-center gap-5 py-20">
            <p className="text-xl">Sign in to open this home.</p>
            <Link href="/" className="text-lg underline underline-offset-4">
              Back to sign-in
            </Link>
          </div>
        ) : homeQuery.error || !homeQuery.data ? (
          <div className="flex flex-col items-center gap-5 py-20">
            <p role="alert" className="text-xl text-[#85513e]">
              {homeQuery.error?.message ?? "Home not found."}
            </p>
            <Button
              onClick={() => void homeQuery.refetch()}
              disabled={homeQuery.isFetching}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Home scenes"
            aria-describedby="home-scene-help"
            onPointerDown={(event) => {
              swipe.current = null;
              if (
                event.button !== 0 ||
                (event.target as Element).closest(
                  "button:not([data-scene-swipe]), a, input, textarea, [data-no-scene-swipe]",
                )
              )
                return;
              swipe.current = {
                x: event.clientX,
                y: event.clientY,
                pointerId: event.pointerId,
              };
            }}
            onPointerMove={(event) => {
              const start = swipe.current;
              if (!start || start.pointerId !== event.pointerId) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4)
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              swipe.current = null;
            }}
            onPointerUp={(event) => {
              const start = swipe.current;
              swipe.current = null;
              if (!start || start.pointerId !== event.pointerId) return;
              const step = getSceneSwipeStep(start, {
                x: event.clientX,
                y: event.clientY,
              });
              if (step) {
                event.preventDefault();
                switchScene(step);
              }
            }}
            className="relative min-h-0 flex-1 touch-pan-y pt-2 pb-11 select-none"
          >
            <SceneEntrance key={`${homeId}:${tab}`} direction={direction}>
              {tab === "fridge" && <BoardView homeId={homeId} />}
              {tab === "tv" && <ReelsView homeId={homeId} />}
              {tab === "book" && <BookView homeId={homeId} />}
            </SceneEntrance>
            {([-1, 1] as const).map((step) => (
              <button
                key={step}
                type="button"
                aria-label={
                  step === -1 ? "Previous home scene" : "Next home scene"
                }
                aria-describedby="home-scene-help"
                onClick={() => switchScene(step)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    switchScene(event.key === "ArrowRight" ? 1 : -1);
                  }
                }}
                className={`sr-only focus:not-sr-only focus:absolute focus:bottom-0 focus:z-40 focus:flex focus:size-11 focus:items-center focus:justify-center focus:rounded focus:bg-[#fffaf0] focus:text-xl focus:outline-2 focus:outline-[#42583d] ${step === -1 ? "focus:left-0" : "focus:right-0"}`}
              >
                {step === -1 ? "←" : "→"}
              </button>
            ))}
            <div className="absolute inset-x-0 bottom-1 flex h-9 items-center justify-center gap-3 text-[14px] text-[#65705a]">
              <span aria-hidden="true" className="flex gap-1.5">
                {TABS.map((scene) => (
                  <span
                    key={scene.id}
                    className={`size-1.5 rounded-full ${scene.id === tab ? "bg-[#829070]" : "bg-[#829070]/25"}`}
                  />
                ))}
              </span>
              <span id="home-scene-help" className="sr-only">
                Swipe left or right, or use the left and right arrow keys to
                switch scenes.
              </span>
              <span aria-hidden="true" className="text-[13px] text-[#829070]">
                Swipe ↔
              </span>
            </div>
          </div>
        )}
      </div>
      {membersOpen && (
        <MembersPanel
          homeId={homeId}
          onClose={() => setMembersOpen(false)}
          onLeave={() => router.push("/app")}
        />
      )}
    </main>
  );
}
