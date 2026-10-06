# Capacitor shell (plan)

Status: **Draft — PAUSED** — grill paused 2026-10-04: owner chose Phase 4 (Vercel deploy) first; resume once the backend URL is live. Nothing below is settled until the owner explicitly accepts it.

## Context (researched from the repo, not yet decided)

- `apps/web` is a full Next.js App Router shell: SSR pages plus API routes (`src/app/api/trpc/[...trpc]`, `src/app/api/workers/*`). The tRPC client uses same-origin `/api/trpc` in the browser (`src/trpc/react.tsx`: `getBaseUrl()` returns `""` on client). A native shell cannot bundle the Next server; it must talk to a deployed backend over absolute HTTPS.
- Realtime is SSE (`httpSubscriptionLink` over EventSource) with the Firebase ID token in connection params; queries/mutations use the `Authorization` header. Any shell must supply both.
- Auth is Firebase Google behind the server seam (`packages/auth`); the web shell uses the Firebase web SDK (`src/platform/auth/`). Google sign-in inside a Capacitor webview needs its own flow decision (web SDK vs native plugin vs system browser).
- Web scenes are heavy: React Three Fiber liquid renderer, GSAP entrances/transitions, Web Audio soundscapes, VHS texture. `packages/ui` holds shared visuals; the web shell owns playback, gestures, and motion.
- Media uploads ride presigned-URL REST to S3-compatible storage; processing runs on QStash workers server-side. Native camera/gallery capture is a possible shell feature.
- Architect rule: `apps/*` are thin shells owning SDKs, auth adapters, env wiring, and navigation only; tRPC routers are the only API definition (D4 planned plain HTTP for future Electron/Capacitor shells; never Expo).
- PLAN.md §1/§4: native shells are explicit demo non-goals ("No themes, no voice, no native shells in the demo"). Phase 4 (Vercel deploy) is not done and Phase 1–3 live reviews are pending. A native shell needs a deployed backend URL, so sequencing against Phase 4 matters.

## Scope contract (unsettled)

- **Artifact-level boundary:** TBD — this interview delivers this plan document only; implementation stages are deferred and need their own go-ahead.
- **Done means:** TBD.
- **Staged designs:** accepting this plan never approves implementation. Each build stage returns for its own approval.
- **Execution words** ("go", "do it all") authorize only the accepted boundary.

## Goals / non-goals (unsettled)

TBD by interview (Q1).

## Decisions

None settled yet.

## Constraints (unsettled)

TBD by interview (platforms, auth flow, backend dependency, device features).

## Risks (initial, unreviewed)

- Capacitor webview must reach the backend over absolute HTTPS: no backend deploy, no native app.
- Firebase Google sign-in inside a webview is a known friction point (popups/redirects); the flow must be chosen deliberately.
- Full scene-art parity (R3F/GSAP/Web Audio) on mobile GPUs is the highest-cost, highest-risk slice.
- App-store review rejects URL-wrapper apps; the shell needs genuine native integration to be listable.

## Validation (unsettled)

TBD by interview (likely: installable build on real hardware, live two-device review mirroring the web gates).

## Unresolved questions

- Q1. End goal of the Capacitor port (scope of "done").
- Shell strategy (new thin native shell vs wrapper vs static export).
- Platforms and order (Android first? iOS?).
- Auth flow in the webview.
- Sequencing against Phase 4 (backend deploy) and pending live reviews.
- Device features in scope (camera capture, push, offline).
- Scene-art parity bar (full R3F/GSAP/Web Audio vs simplified mobile scenes).
- Distribution bar (local dev build vs TestFlight/APK vs public store listing).
