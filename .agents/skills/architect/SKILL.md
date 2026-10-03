---
name: architect
description: Enforce the Noted turbo-shaped architecture (tRPC, Tailwind, Firebase seam, package boundaries) on every structural change.
---

# Noted Architect

You are the architecture gate for this repo. Load this skill before creating packages, apps, routers, schemas, shared configs, or cross-cutting patterns, and before reviewing structural refactors.

## The shape (from create-t3-turbo, verified 2026-09-23)

- pnpm + Turbo v2 pipeline (`turbo.json`): `build`, `dev`, `lint`, `typecheck`, `format` run through turbo with shared caching; CI mirrors the same gates.
- `apps/*`: thin platform shells (Next.js web first; Electron/Capacitor later — never Expo). Shells own SDKs, auth adapters, env wiring, and navigation only.
- `packages/*`: one responsibility each — `api` (tRPC routers), `db` (Drizzle schema + client), `domain` (shared domain rules: time windows, coordinates), `media` (S3 object storage plus image/video variants), `queue` (QStash publishers, job schemas, worker verification), `realtime` (Redis-backed realtime: room pub/sub, board cache, presence), `validators` (pure zod schemas), `ui` (shared visuals), plus shared `tsconfig` / `eslint-config` / `prettier-config` / `tailwind-config`. No package grows a second job; split instead.
- Env: dotenv-loaded root `.env` plus typed env validation per app; server secrets never cross into client code.

## Hard rules

1. tRPC routers are the only API definition: zod input validation, end-to-end inferred types, superjson. Never hand-write an API client or re-declare a call signature in a second place — the v1 `api-client` fetch-wrapper shape must never return (see `docs/decisions/0005-rebuild-on-clean-foundation.md`, D8).
2. Routers stay thin: auth plus membership checks, input validation, then a service call. No SQL in routers, no business rules in components.
3. Firebase Google auth behind a small server seam (verify ID tokens, resolve the app user); shells supply sign-in UI only.
4. Drizzle owns persistence: schema plus migrations in `db`, one client, no raw SQL outside migrations and seed.
5. Styling: Tailwind utilities for UI; bespoke CSS only for the board art layer.
   - Scene artwork includes the illustrated login room: scoped scene CSS may own artwork, screen alignment, and reduced-motion-aware transitions. Interface layout, copy, and controls remain Tailwind.
   - App typefaces use shared Tailwind theme tokens. The web shell bundles Kalam in `src/styles/fonts`, loads it once in the root layout, and applies `font-handwritten` as the default; feature components inherit it rather than loading their own copies.
   - Shared paper texture and button artwork live in `packages/ui`; screens supply accessible controls around this decorative art. The web shell shares login/button/link response through `features/motion/use-paper-motion.ts`. The homes chooser keeps data fetching and mutations in the web shell, uses Tailwind for layout, and separates page/workspace entrances from keyed card entrances so query updates only animate new cards. All motion respects reduced-motion preferences.
   - Home scene shading and bounded illustration masks belong in `styles/home-scene.css`. Scenes fill the viewport below a compact header, with small tool overlays and focus-only native keyboard navigation; the TV leaves room around its frame for the liquid backdrop. The web shell owns pointer capture and navigation; pure swipe direction, scene wrapping, and ready-clip playlist selection live in `packages/ui`. Scene entrances and album turns are keyed to user navigation, never query refreshes. Shared dialogs portal to the document body so scene transforms cannot contain them; they trap and restore focus. The web shell owns clip playback, ready-clip automatic advancement, the clip action menu, fullscreen lifecycle/focus, VHS texture, and gesture-created Web Audio receiver sound; autoplay first attempts sound on and retries muted only on browser autoplay rejection, the sound control stays visible in normal/fullscreen views, explicit mute survives other interactions, off-screen/hidden media pauses, and audio closes on scene unmount. The TV backdrop uses dedicated landscape/portrait sala artwork with the shared lazy memory renderer's room variant and source aspect ratio, reveals only after readiness, and respects reduced motion/hidden-tab redraw limits. Manual clip scrolling wraps one finite list at its boundaries; fresh wheel/touch gestures consume remaining momentum without duplicating players. The web shell animates wrap destinations through temporary adjacent slots with GSAP, restores layout on completion/resize/hiding/unmount, and skips motion when reduced motion is requested. Preserve normalized fridge coordinates and exclude draggable posts from scene gestures; vertical TV scrolling stays inside its clip viewport.
   - The public login uses a bounded illustration behind a DOM invitation. Its liquid-memory renderer belongs in `packages/ui`, contains no auth or domain logic, and uses a dedicated export for lazy loading React Three Fiber. GSAP owns interface motion and completion-driven navigation in the web shell. Keep the illustration hidden until the renderer's first frame; a static image is reserved for renderer failure. The shell owns the accessible controls and renderer error boundary. Reduced motion renders a still image and skips the pull; hidden tabs pause redraws, with mobile redraws capped at 24fps and pixel density at 1.25.
6. Theme system rules: fixed board and CSS slots; a theme is art plus a validated manifest JSON; theme changes are creator-only; posts keep their colors across theme switches.
7. Dependency direction: apps depend on `api` and `queue` (worker routes verify through it), while `api` depends on `auth`, `db`, `domain`, `media`, `queue`, `realtime`, and `validators`; `auth`, `db`, `domain`, `media`, `queue`, `realtime`, `ui`, and `validators` depend on nothing internal. Lint must enforce it; flag any new edge that breaks the direction.
8. Runtime boundaries are visible at the top of source files and enforced by the built-in ESLint `no-restricted-syntax` configuration in `tooling/eslint/boundaries.ts`: backend packages use `import "server-only";`, client UI uses `"use client";`, and shared `domain`/`validators` stay unmarked. App files declare their boundary; `"use server";` is only for Server Functions. Tests and type declarations are exempt. Use standard Node conditions and the marker package's own empty entry for backend tools/tests, not custom shims.

## On every structural change

- Name the turbo package or app the change belongs in; if none fits, propose the new package and its single responsibility first.
- Follow the nearest existing pattern; if the change needs a new pattern, update this skill in the same change.
- Reject bespoke framework-lets: hand-rolled clients, custom wrappers, or one-off scripts that duplicate a turbo task.
