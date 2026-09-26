---
name: architect
description: Enforce the Noted turbo-shaped architecture (tRPC, Tailwind, Firebase seam, package boundaries) on every structural change.
---

# Noted Architect

You are the architecture gate for this repo. Load this skill before creating packages, apps, routers, schemas, shared configs, or cross-cutting patterns, and before reviewing structural refactors.

## The shape (from create-t3-turbo, verified 2026-09-23)

- pnpm + Turbo v2 pipeline (`turbo.json`): `build`, `dev`, `lint`, `typecheck`, `format` run through turbo with shared caching; CI mirrors the same gates.
- `apps/*`: thin platform shells (Next.js web first; Electron/Capacitor later — never Expo). Shells own SDKs, auth adapters, env wiring, and navigation only.
- `packages/*`: one responsibility each — `api` (tRPC routers), `db` (Drizzle schema + client), `validators` (pure zod schemas), `ui` (shared visuals), plus shared `tsconfig` / `eslint-config` / `prettier-config` / `tailwind-config`. No package grows a second job; split instead.
- Env: dotenv-loaded root `.env` plus typed env validation per app; server secrets never cross into client code.

## Hard rules

1. tRPC routers are the only API definition: zod input validation, end-to-end inferred types, superjson. Never hand-write an API client or re-declare a call signature in a second place — the v1 `api-client` fetch-wrapper shape must never return (see `docs/decisions/0005-rebuild-on-clean-foundation.md`, D8).
2. Routers stay thin: auth plus membership checks, input validation, then a service call. No SQL in routers, no business rules in components.
3. Firebase Google auth behind a small server seam (verify ID tokens, resolve the app user); shells supply sign-in UI only.
4. Drizzle owns persistence: schema plus migrations in `db`, one client, no raw SQL outside migrations and seed.
5. Styling: Tailwind utilities for UI; bespoke CSS only for the board art layer.
6. Theme system rules: fixed board and CSS slots; a theme is art plus a validated manifest JSON; theme changes are creator-only; posts keep their colors across theme switches.
7. Dependency direction: apps depend on `api`, which depends on `auth`, `db`, and `validators`; `auth`, `db`, `ui`, and `validators` depend on nothing internal. Lint must enforce it; flag any new edge that breaks the direction.

## On every structural change

- Name the turbo package or app the change belongs in; if none fits, propose the new package and its single responsibility first.
- Follow the nearest existing pattern; if the change needs a new pattern, update this skill in the same change.
- Reject bespoke framework-lets: hand-rolled clients, custom wrappers, or one-off scripts that duplicate a turbo task.
