"use client";

import { PaperButtonArtwork } from "@noted/ui/src";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { LoginScene } from "../features/login/login-scene";
import { usePaperMotion } from "../features/motion/use-paper-motion";
import { useAuth } from "../platform/auth/auth-provider";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.36Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.51l3.34-2.59Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
      />
    </svg>
  );
}

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  usePaperMotion(button);

  const openHomes = useCallback(() => router.replace("/app"), [router]);

  async function signIn() {
    setSigningIn(true);
    try {
      await auth.signIn();
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <LoginScene entering={auth.status === "signed-in"} onEntered={openHomes}>
      <div className="relative z-10 flex w-full flex-col items-center px-4">
        <h2 className="login-copy text-[clamp(34px,5vw,44px)] leading-[1.2] tracking-[-0.04em]">
          Come on in.
        </h2>
        <p
          id={auth.status === "unconfigured" ? "login-unavailable" : undefined}
          role={
            auth.error
              ? "alert"
              : auth.status === "unconfigured"
                ? "status"
                : undefined
          }
          className="login-copy mt-2 max-w-[260px] text-[19px] leading-relaxed text-[#5b6850]"
        >
          {auth.error
            ? "Sign-in failed. Please try again."
            : auth.status === "unconfigured"
              ? "Sign-in is unavailable for now."
              : "Kamusta"}
        </p>
        {auth.status === "signed-in" ? (
          <Link
            href="/app"
            className="relative mt-6 inline-flex min-h-[60px] w-full max-w-[280px] items-center justify-center px-6 text-[19px] text-[#354b35] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d]"
          >
            <PaperButtonArtwork />
            <span className="relative">
              Open your homes <span aria-hidden="true">→</span>
            </span>
          </Link>
        ) : (
          <button
            ref={button}
            type="button"
            onClick={signIn}
            disabled={auth.status !== "signed-out" || signingIn}
            aria-describedby={
              auth.status === "unconfigured" ? "login-unavailable" : undefined
            }
            aria-busy={signingIn || auth.status === "loading"}
            className="relative mt-6 inline-flex min-h-[60px] w-full max-w-[280px] -rotate-[0.7deg] cursor-pointer items-center justify-center gap-3 px-5 text-[18px] leading-none whitespace-nowrap text-[#354b35] focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#42583d] disabled:cursor-wait disabled:opacity-70 motion-reduce:rotate-0"
          >
            <PaperButtonArtwork outlineClassName="paper-outline" />
            <span className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#d6ddc8]/70">
              <GoogleMark />
            </span>
            <span className="relative pt-1">
              {signingIn
                ? "Opening Google…"
                : auth.status === "loading"
                  ? "Getting ready…"
                  : "Continue with Google"}
            </span>
          </button>
        )}
      </div>
    </LoginScene>
  );
}
