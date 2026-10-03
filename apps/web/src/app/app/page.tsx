"use client";

import { useGSAP } from "@gsap/react";
import { PaperButtonArtwork, PaperTexture } from "@noted/ui/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { NotedLogo } from "../../features/brand/noted-logo";
import { usePaperMotion } from "../../features/motion/use-paper-motion";
import { useAuth } from "../../platform/auth/auth-provider";
import { useTRPC } from "../../trpc/react";

gsap.registerPlugin(useGSAP);

function HomesWorkspace({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".home-shell-enter",
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            stagger: 0.1,
            ease: "power2.out",
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
      className="grid gap-12 pt-9 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14"
    >
      {children}
    </div>
  );
}

function HomeCard({
  href,
  index,
  children,
}: {
  href: string;
  index: number;
  children: ReactNode;
}) {
  const root = useRef<HTMLLIElement>(null);
  const paper = useRef<HTMLAnchorElement>(null);
  usePaperMotion(paper);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root.current,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: Math.min(index * 0.07, 0.28),
            ease: "power2.out",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root },
  );
  return (
    <li ref={root} className="opacity-0 motion-reduce:opacity-100">
      <Link
        ref={paper}
        href={href}
        className="relative flex min-h-[112px] items-center gap-4 px-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] sm:gap-5 sm:px-6"
      >
        <PaperButtonArtwork outlineClassName="paper-outline" />
        <div className="relative flex w-full items-center gap-4 sm:gap-5">
          {children}
        </div>
      </Link>
    </li>
  );
}

function HomeSketch({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 45 L49 16 L85 44 M22 41 L23 82 L77 83 L78 41" />
      <path d="M42 82 L42 57 Q51 54 59 57 L60 82" fill="#d9dfc9" />
      <path
        d="M30 48 L37 48 L37 59 L30 59Z M65 48 L71 48 L71 59 L65 59Z"
        fill="#f1e5c8"
      />
      <path d="M8 87 Q44 84 90 87 M52 68 L53 68 M13 80 L12 67 M12 74 Q4 71 5 66 Q13 66 12 74 M12 70 Q18 64 20 67 Q19 73 12 74" />
      <path
        d="M75 18 Q83 11 86 19 Q89 27 79 28 Q73 26 75 18 M81 6 L81 2 M94 12 L98 9 M94 28 L98 31"
        stroke="#b69a61"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function HomesPage() {
  const auth = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const root = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const meOptions = trpc.me.get.queryOptions();
  const me = useQuery({ ...meOptions, enabled: auth.status === "signed-in" });
  const create = useMutation(
    trpc.homes.create.mutationOptions({
      onSuccess: () => {
        setName("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: meOptions.queryKey });
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".homes-page-content",
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.9,
            ease: "sine.out",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root },
  );

  async function signOut() {
    setSigningOut(true);
    try {
      await auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main
      ref={root}
      className="relative isolate min-h-svh overflow-hidden bg-[#f7f2e7] px-5 pb-12 text-[#394b38] selection:bg-[#c8d3b4] sm:px-8"
    >
      <PaperTexture />
      <div className="homes-page-content relative mx-auto max-w-[960px] opacity-0 motion-reduce:opacity-100">
        <header className="flex min-h-[120px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#829070]/25 py-5 sm:min-h-[140px]">
          <Link
            href="/app"
            aria-label="Noted homes"
            className="shrink-0 -rotate-2 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#42583d]"
          >
            <NotedLogo
              className="h-auto w-[150px] sm:w-[220px]"
              sizes="(min-width: 640px) 220px, 150px"
            />
          </Link>
          {auth.status === "signed-in" && (
            <div className="flex max-w-full items-center gap-4 sm:gap-6">
              <p
                className="max-w-[150px] truncate text-base text-[#65705a] sm:max-w-[260px] sm:text-lg"
                title={auth.user.displayName ?? auth.user.email ?? undefined}
              >
                {auth.user.displayName ?? auth.user.email}
              </p>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                aria-busy={signingOut}
                className="min-h-11 shrink-0 cursor-pointer text-[17px] underline decoration-[#829070]/40 underline-offset-4 hover:text-[#263d28] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] disabled:cursor-wait disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </header>

        {auth.status === "loading" ? (
          <section className="py-16 text-center" role="status">
            <HomeSketch className="mx-auto mb-5 w-28 text-[#829070]" />
            <p className="text-xl">Getting your homes ready…</p>
          </section>
        ) : auth.status !== "signed-in" ? (
          <section className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            <HomeSketch className="mb-5 w-36 text-[#829070]" />
            <h1 className="text-[36px] leading-tight">Your homes</h1>
            <p className="mt-3 text-lg text-[#65705a]">
              Sign in to see your homes.
            </p>
            <Link
              href="/"
              className="relative mt-7 inline-flex min-h-[60px] w-full max-w-[240px] items-center justify-center text-[19px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d]"
            >
              <PaperButtonArtwork />
              <span className="relative">
                Back to sign-in <span aria-hidden="true">↗</span>
              </span>
            </Link>
          </section>
        ) : (
          <HomesWorkspace>
            <section aria-labelledby="homes-title">
              <div className="home-shell-enter mb-7 flex items-baseline justify-between gap-4 opacity-0 motion-reduce:opacity-100">
                <h1
                  id="homes-title"
                  className="text-[36px] leading-tight tracking-[-0.04em] sm:text-[42px]"
                >
                  Your homes
                </h1>
                {me.data && me.data.homes.length > 0 && (
                  <span className="text-base text-[#65705a]">
                    {me.data.homes.length}{" "}
                    {me.data.homes.length === 1 ? "home" : "homes"}
                  </span>
                )}
              </div>
              {me.isLoading && (
                <p role="status" className="py-10 text-lg text-[#65705a]">
                  Finding your homes…
                </p>
              )}
              {me.error && (
                <div
                  role="alert"
                  className="border-l-2 border-[#a7684e] py-2 pl-4 text-lg text-[#85513e]"
                >
                  <p>We couldn’t load your homes.</p>
                  <button
                    type="button"
                    onClick={() => void me.refetch()}
                    disabled={me.isFetching}
                    className="mt-2 min-h-11 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60"
                  >
                    {me.isFetching ? "Trying again…" : "Try again"}
                  </button>
                </div>
              )}
              {me.data &&
                (me.data.homes.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center sm:py-12">
                    <HomeSketch className="mb-5 w-[180px] text-[#829070]" />
                    <h2 className="text-[27px]">No homes yet.</h2>
                    <p className="mt-2 max-w-[300px] text-[18px] leading-relaxed text-[#65705a]">
                      Create your first home, or ask someone to invite you to
                      theirs.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {me.data.homes.map((home, index) => (
                      <HomeCard
                        key={home.id}
                        href={`/app/homes/${home.id}`}
                        index={index}
                      >
                        <HomeSketch className="w-[58px] shrink-0 text-[#829070] sm:w-[68px]" />
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[25px] leading-tight break-words sm:text-[29px]">
                            {home.name}
                          </h2>
                          <p className="mt-2 text-[15px] text-[#65705a]">
                            {home.role === "creator" ? "Creator" : "Member"}
                          </p>
                        </div>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[28px] text-[#829070]"
                        >
                          ↗
                        </span>
                      </HomeCard>
                    ))}
                  </ul>
                ))}
              <p className="home-shell-enter mt-7 text-[16px] leading-relaxed text-[#65705a] opacity-0 motion-reduce:opacity-100">
                Homes you’re invited to appear here automatically.
              </p>
              {auth.error && (
                <p role="alert" className="mt-4 text-lg text-[#85513e]">
                  {auth.error}
                </p>
              )}
            </section>

            <aside className="home-shell-enter rotate-[0.7deg] self-start rounded-[3px_10px_4px_8px] bg-[#ebe9d9]/75 px-6 py-7 opacity-0 shadow-[2px_4px_0_#d4d6bd50] motion-reduce:opacity-100 sm:px-7 lg:mt-1">
              <svg
                aria-hidden="true"
                viewBox="0 0 80 22"
                className="mx-auto -mt-10 mb-6 h-6 w-20 -rotate-3 text-[#d2cca8]"
                fill="currentColor"
              >
                <path
                  d="M2 3 L11 1 L19 3 L28 1 L38 3 L46 0 L56 3 L66 1 L76 3 L78 20 L68 18 L59 21 L49 18 L39 20 L29 18 L20 21 L10 19 L3 21Z"
                  opacity="0.85"
                />
              </svg>
              <h2 id="create-home-title" className="text-[28px] leading-tight">
                Start a home
              </h2>
              <p className="mt-2 text-[17px] leading-relaxed text-[#65705a]">
                A shared place for your family’s notes, photos, and little
                moments.
              </p>
              <form
                aria-labelledby="create-home-title"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim() || create.isPending) return;
                  setError(null);
                  create.mutate({ name: name.trim() });
                }}
                className="mt-6 flex flex-col gap-4"
              >
                <div>
                  <label htmlFor="home-name" className="text-[17px]">
                    Home name
                  </label>
                  <input
                    id="home-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Our little home"
                    maxLength={80}
                    required
                    disabled={create.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "create-home-error" : undefined}
                    className="mt-2 min-h-[52px] w-full min-w-0 rounded-[3px_6px_4px_7px] border border-[#829070]/35 bg-[#fffaf0] px-3 text-[19px] text-[#394b38] placeholder:text-[#65705a] focus:border-[#42583d] focus:outline-2 focus:outline-offset-2 focus:outline-[#829070]/35 disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={create.isPending || !name.trim()}
                  aria-busy={create.isPending}
                  className="relative inline-flex min-h-[58px] cursor-pointer items-center justify-center text-[20px] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0"
                >
                  <PaperButtonArtwork />
                  <span className="relative">
                    {create.isPending ? "Making your home…" : "Create home"}
                  </span>
                </button>
                {error && (
                  <p
                    id="create-home-error"
                    role="alert"
                    className="text-[17px] leading-relaxed text-[#85513e]"
                  >
                    {error}
                  </p>
                )}
              </form>
              <p className="mt-5 text-[15px] leading-relaxed text-[#65705a]">
                You can invite your family once it’s created.
              </p>
            </aside>
          </HomesWorkspace>
        )}
      </div>
    </main>
  );
}
