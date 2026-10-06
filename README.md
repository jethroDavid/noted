# Noted

A shared family kitchen board built as a skill demo on a turbo-shaped
stack: tRPC, Tailwind, Drizzle, Firebase auth, SSE realtime with Redis
fan-out, and queued media workers.

Live demo: `https://noted-six-chi.vercel.app`
Installers: `https://github.com/jethroDavid/noted/releases` (Windows setup
plus Android APK, cut from `desktop-v*` and `mobile-v*` tags)

Start with [PLAN.md](./PLAN.md), then
[ADR 0005](./docs/decisions/0005-rebuild-on-clean-foundation.md). The project
`architect` skill gates every structural change.

## The demo

One shared family kitchen in a fixed illustrated scene, with Google
sign-in and multi-user homes (members plus invitations):

- TV: a vertical short-video feed. Reels expire 7 days after creation and
  archive into the photobook as playable clips (daily `sweep-reels` job);
  deleting a reel manually archives it the same way.
- Fridge: text and photo notes (drag, modal edit). Deleting a text note
  removes it instantly with a 10-second Undo toast; removing a photo
  archives it straight to the book.
- Photobook: the archive for removed photos and expired or moved clips,
  with originals viewable and a Delete forever path.

There are no themes, no voice, and no offline mode: the point of the demo
is the shared tech (realtime plus cache plus queues plus workers), not the
feature list.

## Architecture

- Turbo v2 plus pnpm monorepo: `apps/*` are thin platform shells,
  `packages/*` hold single responsibilities, `tooling/*` holds shared
  configs. CI mirrors the local gates.
- API: tRPC plus zod plus superjson is the only API definition, served
  from one `/api/trpc` route. Routers stay thin (auth plus membership,
  validation, then a service call). Hand-written API clients are banned.
- Realtime: tRPC subscriptions over SSE on the same route (plain HTTP
  streaming, no sockets); Redis pub/sub rooms fan out across instances,
  with board-read cache plus event invalidation and board presence.
  Events are invalidation signals (`board-changed`, `media-changed`),
  not patches; EventSource reconnects natively and each resubscribe
  refetches state. If the pill shows Offline, the stream is broken,
  not the board.
- Queue and workers: Upstash QStash publishers plus zod job schemas in
  `packages/queue`, delivered to thin `/api/workers/*` routes (verify,
  parse, service call). Jobs: photo thumbnails plus reel posters,
  variant cleanup on removal, scheduled reel sweep. The QStash dev
  server signs and delivers locally with no tokens.
- Media: presigned-URL uploads straight to S3-compatible storage
  (MinIO locally, CDK-owned bucket in production). Attach verifies the
  bytes and publishes the process job; reads mint fresh presigned GETs
  after the membership check.
- Data: Drizzle owns persistence (schema plus migrations, one client).
  Local Postgres via compose, managed Postgres in production.
- Auth: Firebase Google sign-in behind a small server seam (ID token
  verification plus app-user sync). SSE carries the token as connection
  params; queries and mutations use the `Authorization` header.

## Shells

- `apps/web`: the full Next.js shell (routes, providers, auth UI,
  board scenes). Also serves the tRPC API and worker routes.
- `apps/mobile`: thin Capacitor Android wrapper loading production in a
  webview, with native camera and gallery capture and redirect sign-in.
  See its README for commands and the `mobile-v*` release flow.
- `apps/desktop`: thin Electron window loading production remotely,
  with popup sign-in and an unsigned Windows NSIS installer. See its
  README for commands and the `desktop-v*` release flow.

## Setup

Prereqs: Node 24 (see `.nvmrc`), pnpm 10, Docker.

```sh
pnpm install
cp .env.example .env   # fill in real values; never commit .env
pnpm run setup        # starts Postgres + Redis + MinIO, runs migrations (`run` avoids pnpm's builtin)
pnpm dev:web           # Next.js app
```

The dev server uses `PORT` from `.env` (3000). If that port is taken on
your machine, change it there.

Seed a starter home after setup:

```sh
pnpm db:seed -- --email you@example.com --subject <firebase-uid>
```

Demo media lives in `test-media/` (gitignored working-tree folder of
family photos and vintage clips for upload testing).

## Gates

```sh
pnpm check   # format + lint + typecheck + test + synth + build, all through turbo
```

CI mirrors the same six tasks. Nothing merges red.

## Layout

- `apps/web` — Next.js shell: routes, providers, auth UI, board scenes.
- `apps/mobile` — Capacitor Android shell: native wrapper plus camera.
- `apps/desktop` — Electron shell: desktop window plus installer.
- `packages/api` — tRPC routers, the only API definition.
- `packages/db` — Drizzle schema, client, migrations, seed.
- `packages/domain` — shared domain rules (removal window, coordinates,
  reel lifetime).
- `packages/realtime` — Redis-backed realtime (room pub/sub, board cache,
  presence).
- `packages/media` — S3 object storage plus image and video variants.
- `packages/queue` — QStash publishers, job schemas, worker verification.
- `packages/auth` — Firebase server seam (verify ID tokens) and env.
- `packages/validators` — pure zod schemas shared by API and app.
- `packages/ui` — shared visual components plus scene utilities.
- `packages/infra` — AWS CDK app owning the production media bucket.
- `tooling/*` — shared typescript, eslint (plus boundary rules), prettier,
  and tailwind configs, plus the CI setup action.

Libraries export `./src` directly and are typechecked, not built; only the
shells build. Dependency direction is apps toward `api` (plus `queue` for
worker routes) toward `auth`/`db`/`domain`/`media`/`queue`/`realtime`/
`validators`, with `infra` deploy-time only (nothing imports it at
runtime).

Source files declare their runtime boundary, enforced with ESLint's
built-in `no-restricted-syntax`: backend packages start with
`import "server-only";`, client UI modules start with `"use client";`,
and shared `domain`/`validators` stay unmarked. App files declare either
boundary; `"use server";` is reserved for Server Functions. Tests and type
declarations are exempt. The Electron main process and Capacitor config
take no Next markers (plain Node outside the server/client model).

## Database workflow

```sh
pnpm db:generate   # after editing packages/db/src/schema.ts
pnpm db:migrate    # applies pending migrations to local Postgres
pnpm db:seed -- --email you@example.com --subject <firebase-uid>
```

Run `pnpm format:fix` after generating: Drizzle writes its meta files in
its own style.

## Production

See [docs/deployment.md](./docs/deployment.md) for the full runbook
(topology, every env var, the deploy-day incident log) and
[docs/plans/phase-4-s3-deploy.md](./docs/plans/phase-4-s3-deploy.md) for
the S3 bucket wiring. In short: Vercel hosts the web shell, Neon holds
Postgres, Upstash holds Redis plus QStash, AWS S3 (CDK-owned) holds
media, Firebase holds Google auth. Keep `git config user.email` on the
personal address: Vercel Hobby blocks deploys from other identities.

## Docs map

- `PLAN.md` — the phased roadmap and working agreements.
- `docs/decisions/` — rebuild foundation (0005) plus reel sweep (0006).
- `docs/plans/phase-1-shared-noting-core.md`,
  `phase-2-realtime-backbone.md`, `phase-3-media-pipeline.md` —
  worked-out phase details; each phase has a live-review drill.
- `docs/plans/capacitor-shell.md` (superseded by the shipped shell),
  `electron-shell.md` — shell plans and follow-ups.
- `docs/plans/qa-driving-lanes.md` — QA drill lanes.
- `docs/design/` — scene, brand, and entrance design notes.
