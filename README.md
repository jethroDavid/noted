# Noted

A shared family kitchen board — fridge notes, TV reels, and a photo book — built as a skill demo on a turbo-shaped stack: tRPC, Tailwind, Drizzle, Firebase auth, Vercel-native WebSockets with Redis fan-out, and queued media workers.

Start with [PLAN.md](./PLAN.md), then [ADR 0005](./docs/decisions/0005-rebuild-on-clean-foundation.md). The project `architect` skill gates every structural change.

## Setup

Prereqs: Node 24, pnpm 10, Docker.

```sh
pnpm install
cp .env.example .env   # fill in real values; never commit .env
pnpm run setup        # starts Postgres, runs migrations (`run` avoids pnpm's builtin)
pnpm dev:web           # Next.js app with the tRPC hello round-trip
```

The dev server uses `PORT` from `.env` (3000). If that port is taken on your machine, change it there.

## Gates

```sh
pnpm check   # format + lint + typecheck + test + build, all through turbo
```

CI mirrors the same five tasks. Nothing merges red.

## Layout

- `apps/web` — Next.js shell: routes, providers, auth UI, board scene.
- `packages/api` — tRPC routers, the only API definition.
- `packages/db` — Drizzle schema, client, migrations.
- `packages/domain` — shared domain rules (removal window, coordinates).
- `packages/auth` — Firebase server seam (verify ID tokens) and env.
- `packages/validators` — pure zod schemas shared by API and app.
- `packages/ui` — shared visual components.
- `tooling/*` — shared tsconfig, eslint, prettier, tailwind configs plus the CI setup action.

Libraries export `./src` directly and are typechecked, not built; only the app builds. Dependency direction is apps → `api` → `auth`/`db`/`domain`/`validators`, enforced by lint.

## Database workflow

```sh
pnpm db:generate   # after editing packages/db/src/schema.ts
pnpm db:migrate    # applies pending migrations to local Postgres
pnpm db:seed -- --email you@example.com --subject <firebase-uid>
```

Run `pnpm format:fix` after generating — Drizzle writes its meta files in its own style.
