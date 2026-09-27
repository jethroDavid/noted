# Rebuild on a clean foundation

Date: 2026-09-23

Status: Final (scope accepted; stage authorization recorded below)

## Context

The owner judges the current repository a mess with the wrong foundation and wants to start over, copying or referencing the `t3-oss/create-t3-turbo` monorepo shape. Product learnings carry over: the shared-notes product, the noting interaction model, and the per-home board-themes direction (see `.agents/plans/2026-09-23-board-themes.md`). This record settles the rebuild decisions one at a time.

Starting state: `origin` points at `https://github.com/jethroDavid/noted.git`; history is 6 commits. The worktree holds uncommitted work (an unfinished Unit A rename plus the owner's own `PLAN.md` edit); its fate is decided below, not assumed.

## Decisions

### D1. Reset scope — SETTLED 2026-09-23

Same repository (`jethroDavid/noted`), rebuilt from an empty tracked tree. Owner's words: "i want to start from empty repo, we can use this one, but i want to start from nothing". History is preserved behind an `archive/noted-v1` tag (stated default; history destruction was not requested and needs its own explicit ask). No new repo or directory. Rationale: one repo, history, and remote; old work stays recoverable; decision records stay with the code.

### D2. What survives the reset — SETTLED 2026-09-23

Wipe everything except credentials and env: archive-commit the current tracked tree (including the owner's `PLAN.md` edit), tag `archive/noted-v1`, then delete all tracked files. Also drop the local Postgres tables/database and regenerable artifacts (`node_modules`, build outputs) — anything that could conflict with the new scaffold. Keep `.env` and the Firebase credentials (service key plus `.local/firebase-config`) so work can continue without redoing provider setup. Owner's words: "i think 1, delete tables, maybe database, just anything that would be painful to delete, could cause any issue with the new thing, the env + firebase make sense not to remove". Owner directed no follow-up questions on this point.

### D3. Turbo adoption — SETTLED 2026-09-23

Reference the shape, scaffold fresh (owner picked option 1). Take `create-t3-turbo`'s `turbo.json` pipeline, `apps/*` + `packages/*` layout, shared tsconfig/eslint/prettier configs, and dotenv env pattern; build it with our stack, not the template's (verified 2026-09-23: the template ships tRPC, better-auth/Discord, Drizzle + Vercel Postgres, and Next.js + Expo apps — Expo, better-auth, and Vercel Postgres do not fit our Electron/Capacitor targets, working Firebase setup, and Neon plan, so a full clone would gut half the template).

### Standing stack defaults (recorded 2026-09-23, vetoable)

Carried without a question: Firebase Google auth stays (credentials deliberately preserved in D2, integration already works); Drizzle ORM stays (both stacks use it, no signal to change); local Postgres for development plus Neon for deployment stays (unchanged from the v1 plan).

### D4. API style — SETTLED 2026-09-23

tRPC + zod + superjson (owner picked option 1), following the turbo default. One router definition replaces v1's triple of contracts schemas, api-client methods, and server services. Still plain HTTP underneath for the future Electron/Capacitor shells. Media uploads ride a small REST side-path (standard tRPC pattern); details deferred to the media phase.

### D5. Styling approach — SETTLED 2026-09-23

Tailwind plus a small custom board layer (owner picked option 1), following the turbo default (verified: `tailwindcss` with a shared config package, Next 16, React 19 — same majors v1 already runs). Utilities for day-to-day UI; bespoke CSS only for the board art (painted look, post cards), so v1's 1,800-line single stylesheet does not return.

### D6. v2 product scope — SETTLED 2026-09-23 (as a process decision)

Scope is not pre-decided here. The owner directed: "we start with a plan again, plan with phases, we rebuild the plan and phases from scratch, use all the learnings from this previous attempt, to create a better foundation". So v2 scope and phasing are fixed by a fresh phased plan (the new PLAN.md), built from v1's PLAN.md, the board-themes plan, and decisions D1–D5 of this record. None of the Q6 milestone options was adopted or rejected. Carried into the plan stage as the default (revisitable there): native shells, map, and activities stay later phases.

### D7. Architect skill form — SETTLED 2026-09-23

Project-local architect skill in this repo (owner picked option 1). It encodes turbo + Noted-specific best practices (tRPC layout, theme slots, Firebase seam, package boundaries) and travels with the code so every future session gets it automatically. Exact directory and trigger mechanics are resolved at authoring time.

### D8. "Better foundation" done criteria — SETTLED 2026-09-23

Headline rule from the owner: the repo must follow a clear pattern. The v1 hand-written `packages/api-client/src/index.ts` shape (bespoke fetch wrapper with a hand-maintained method list) is explicitly the thing to never repeat. Owner's words: "the previous code like this ... is really something i hate ... im use to working with real framework like laravel and angular, which there is clear pattern, and the code dont never get ugly like that ever". The owner is upfront about not knowing this stack's idioms, which is why the rebuild references `create-t3-turbo` and why D7's architect skill exists to hold the pattern. This confirms D4: tRPC's typed client replaces the hand-written api-client entirely.

Operational checklist (proposed by interviewer, carried unopposed):

1. One-command setup from an empty clone works and is documented once.
2. A single gate (types, lint, tests, build) is green locally and mirrored by CI.
3. tRPC end-to-end typesafety with no hand-written API client duplication.
4. Package boundaries documented and lint-enforced; the architect skill exists and loads automatically.
5. The fresh phased `PLAN.md` exists and its Phase 0/1 exit checks pass on the new tree.

## Scope contract

**This lane (the grill) delivers:** this decision record only — `docs/decisions/0005-rebuild-on-clean-foundation.md`, Draft until the owner explicitly accepts the text, then Final.

**Out of scope here:** the archive-commit/tag/wipe, the fresh scaffold, the new phased `PLAN.md`, the architect skill file, and any runtime code. Each is a deferred stage needing its own interview and explicit approval; accepting this record approves none of them.

**Done means:** (1) the owner explicitly accepts this scope text; (2) this record flips to Final with the acceptance quoted; (3) no unresolved items remain.

**Execution words** ("go", "do it all") authorize only this boundary. Wider work needs a new explicit approval or its own follow-up.

Acceptance: owner reply 2026-09-23 (chat): "i think we can start the skill, planning and deleting" — taken as scope acceptance plus go-ahead for the skill, planning, and wipe stages.

## Amendment 2026-09-24 — skill-demo reframing (interview in progress)

Owner reframed the effort (chat 2026-09-24): the framework stays, but this is a demo of skill, not a product. Narrow app: kitchen background, fridge board, a TV with short videos like reels, a simple photo book — "that is it". Photo book holds images removed from the fridge.

Q1 (demo scope) answer (chat 2026-09-24): "no this is shared, that is the point of the demo, we are going to use websocket, pub/sub, redis / cache, queues, workers, the challenge is to use all this tech, host it in vercel, the postgres is a service, probably s3".

Settled: the demo is SHARED (multi-user) and its point is demonstrating the tech (realtime plus cache plus queues plus workers). Foundation decisions D3–D5 stand unchanged. Hosting fixed: Vercel (was TBD). Postgres fixed: managed service (Neon stays the default). Object storage: probably S3 (S3-compatible API assumed).

Standing demo-scope defaults (vetoable): fixed kitchen scene with the theme system deferred to a product backlog; text plus photo fridge with no voice; uploads go to S3-compatible storage via presigned URLs; workers handle media processing (thumbnails, poster frames) as the queue's initial job list.

Q2 settled (chat 2026-09-24): owner picked option 1 — Vercel-native WebSockets (public beta via `experimental_upgradeWebSocket()` on Fluid Compute) with Redis pub/sub fan-out for cross-instance delivery. Accepted caveats: connections die at function max duration (client reconnects), beta status, Fluid billing. Research behind the options: multiple 2026 sources confirm the beta and Vercel's Redis-fan-out guidance; official docs inspected at plan time (see revised PLAN.md sources).

Q2 transport superseded (chat 2026-09-26): owner picked SSE — tRPC subscriptions over EventSource on `/api/trpc` — over the WebSocket beta. Equally capable for one-way event taps, zero local config, no CLI or login. Redis fan-out unchanged. See PLAN.md and `docs/plans/phase-2-realtime-backbone.md`.

Q3 resolved by default (veto at plan approval, no question asked): queue provider is Upstash QStash (same vendor as Redis, Vercel marketplace, HTTP delivery to API-route workers, zero new infra); initial job list is media processing (photo thumbnails, reels poster frames, variant cleanup on removal). Rationale: the demo needs the queue/worker categories, not a specific logo; vendor consolidation keeps the realtime backbone, cache, and queue on one integration.

Amendment interview closed 2026-09-24: no unresolved items; revised PLAN.md carries the details for approval.

## Unresolved questions

- Scope-contract acceptance (this record becoming Final) — the only remaining item.
