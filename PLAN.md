# Noted — Skill-Demo Build Plan

Status: Accepted 2026-09-24 — the rebuild roadmap. This is a demo of skill, not a product: a narrow shared app whose point is demonstrating the tech (realtime, cache, queues, workers) on a clean turbo-shaped foundation. Governed by `docs/decisions/0005-rebuild-on-clean-foundation.md` (plus 2026-09-24 amendment) and the project `architect` skill. v1 is preserved behind the `archive/noted-v1` tag.

## Progress

- [ ] Phase 0 — Foundation scaffold (in progress)
- [ ] Phase 1 — Shared noting core
- [ ] Phase 2 — Realtime backbone
- [ ] Phase 3 — TV reels, photo book, media pipeline
- [ ] Phase 4 — Hardening and Vercel deploy

## 1. The demo

One shared family kitchen, fixed scene: kitchen background, fridge board with text and photo notes (drag, modal edit; text notes use one-hour grey removal with shared Undo, removed photos archive straight to the book), a TV with a vertical short-video feed (reels-style playback), and a photo book that auto-archives images removed from the fridge. Multi-user shared homes with Google auth. No themes, no voice, no native shells in the demo.

## 2. Architecture (settled)

- Turbo shape: pnpm plus Turbo v2 pipeline, `apps/*` thin shells, `packages/*` single-responsibility, `tooling/*` shared configs, CI mirroring the local gate.
- API: tRPC plus zod plus superjson is the only API definition; media uploads use a presigned-URL REST side-path to S3-compatible storage.
- Realtime: Vercel-native WebSockets (public beta, Fluid) via the documented Next.js upgrade API; Redis pub/sub (Upstash via Vercel Marketplace) for cross-instance fan-out, rooms, and presence; client reconnect with resubscribe plus state reload. Mutations travel over tRPC, events publish to Redis, rooms broadcast to subscribers.
- Cache: Redis caches board reads; mutation events invalidate. Local Redis via compose for development.
- Queue and workers: Upstash QStash with publishers plus zod job schemas in `packages/queue` and HTTP API-route workers. Jobs: photo thumbnails, reels poster frames, variant cleanup on removal.
- Data: Drizzle; local Postgres for development, managed Postgres service in production (Neon is the standing default). Firebase Google auth behind a small server seam.
- Web: Next.js plus Tailwind plus a small board-art layer, hosted on Vercel.
- The `architect` skill gates every structural change. Headline rule: the repo follows a clear pattern — the v1 hand-written `api-client` shape must never return.

## 3. Learnings carried from v1

Keep: normalized 0..1 coordinates; last-save-wins with per-operation membership checks; one-hour grey removal with shared Undo for text, instant book archive for removed photos; server-anchored clock; preview-then-commit drags; generation-stamped operations; flat SVG fallback when art fails; live two-account and physical-phone reviews gating every trust claim.

Changed: polling is replaced by WebSocket plus Redis realtime (polling survives only as Phase 1's temporary transport); themes, AI generation, and voice move to the product backlog.

Banned: hand-written API clients; a single giant stylesheet; API contracts defined in more than one place; growth-decor complexity; per-theme geometry; bespoke framework-lets of any kind.

## 4. Phases

### Phase 0 — Foundation scaffold (in progress)

Turbo tree, shared configs, pipeline plus CI mirror, Drizzle with local Postgres and migrations, dotenv env with typed validation, Firebase seam skeleton, Tailwind plus board-art skeleton, one-command setup documented. Exit: the foundation done criteria pass on an empty app, including a typed tRPC hello round-trip.

### Phase 1 — Shared noting core

Auth plus homes, members, and fridge text and photo notes with text slow-removal plus Undo and instant photo archive to the book store (book UI lands in Phase 3); temporary refetch transport; seed plus fixtures including bundled fridge photos and sample reels. Exit: two-browser shared noting works end to end; gate green.

### Phase 2 — Realtime backbone

WebSocket route plus Fluid config plus Redis pub/sub rooms and fan-out plus client reconnect; board-read cache with event invalidation; compose gains local Redis; Upstash env wired. Polling removed. Exit: live two-browser updates; reconnect drill (kill plus resume) passes; cache hits verified.

### Phase 3 — TV reels, photo book, media pipeline

S3 presigned uploads; QStash publishers plus workers for thumbnails, poster frames, and cleanup; reels feed UI; book archive UI; remove-to-book flow. Exit: upload to process to playback works end to end; removal archives to the book; non-member access rejected.

### Phase 4 — Hardening and Vercel deploy

Neon plus Upstash plus S3 production wiring; rate and cost guards; Fluid and beta limits documented and verified; live two-account and physical-phone reviews. Exit: public demo URL; reviews pass; gates green.

### Later — product backlog (explicit non-goals)

Theme system plus AI generation, voice notes, Electron and Capacitor shells, map, activities, multi-board scenes.

## 5. Working agreements

- The `architect` skill loads before every structural change; new patterns update the skill in the same change.
- No phase starts until the previous phase's exit criteria pass.
- Trust claims (sharing, devices, touch) require the live reviews, never emulation alone.
- This plan is the roadmap; phase details are worked out when each phase starts.

## 6. Sources

- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/turbo.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/packages/api/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/packages/auth/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/packages/db/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/packages/validators/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/apps/nextjs/package.json`
- `https://raw.githubusercontent.com/t3-oss/create-t3-turbo/main/.github/workflows/ci.yml`
- `https://vercel.com/docs/functions/websockets`
- `https://upstash.com/docs/redis`
- `https://upstash.com/docs/qstash`
- v1 tree and prior plans: `archive/noted-v1` tag (`PLAN.md`, `.agents/plans/2026-09-23-board-themes.md`)
