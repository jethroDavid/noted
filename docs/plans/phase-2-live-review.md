# Phase 2 live review — owner handoff

Implemented 2026-09-26. Gate green (42 tests), probes green (14
caller-level checks; the 3 SSE-bridge checks run in the gate), seed +
fixtures done. The remaining exit items are the live two-browser pass
and the reconnect drill, which need real Google sign-in (trust claims
require live reviews, never emulation).

Local realtime runs under plain `next dev`: subscriptions are SSE on
`/api/trpc` — no Vercel CLI, no login, no separate route. If the pill
shows "Offline — updates paused", the stream (not the board) is broken.

## One-time setup

1. `docker compose up -d` (Postgres + Redis), `pnpm db:migrate`.
2. `pnpm dev:web` (Next on http://localhost:3000, or PORT from `.env`).
3. Pre-check (new terminal, repo root):
   `node .local/scratch/phase2-sse-probe.mjs 3000` →
   `ok - hello over /api/trpc` plus `ok - SSE subscription path live`.
   If it fails, the tRPC route — not the board — is broken.
4. Sign in once, then seed (uid from Authentication → Users):
   `pnpm db:seed -- --email <you> --subject <uid>`.

## The two-browser pass

Browser A (account A) + a second browser or profile (account B):

1. A opens the seeded home; B signs in (sees no homes). Pills show
   Live; once both open the board, each sees the other's avatar.
2. A invites B by email (Members panel); B reloads `/app` → home
   appears. (Members still need a reload — unchanged from Phase 1.)
3. A adds a text note → it appears in B instantly.
4. B drags the note → position lands in A instantly.
5. A deletes the note → it vanishes in both instantly; an Undo toast
   shows in A for 10 seconds; A presses Undo → the note returns in both.
6. A sticks a photo → visible in B; A archives it → gone from the
   board, an Undo toast shows in A for 10 seconds; A presses Undo →
   the photo returns in both (and leaves the book store).
7. A removes B (Members panel) → B's board flips to "Home not found"
   at once, and B's avatar leaves A's viewers.

## The reconnect drill

1. A and B viewing the board (both Live).
2. Stop the dev server (Ctrl+C) → both pills show Connecting….
3. Restart it → both pills return to Live without a reload.
4. A adds a note → it appears in B: resubscribe plus state reload
   healed the gap.

## Cache hits

With a board open:

1. `docker exec noted-redis-1 redis-cli --scan --pattern 'board:cache:*'`
   → one key: the open board's cached read.
2. Move any note → the key is gone (mutation invalidated it)…
3. …and back after the subscribers' refetch rebuilt it.

## Known Phase 2 limits (not failures)

- Members panel needs a reopen for others' changes (no member events).
- An abruptly closed tab (killed process, no unload) lingers in
  viewers for up to ~20s; graceful navigation leaves instantly.
- A Redis blip exactly at subscribe time can stall one subscription
  (pill shows Offline) until navigation; reads and mutations keep
  working throughout.
- Undo snapshots still live in the deleter's browser tab; reloading
  inside the 10 seconds loses them.
- Fixture photos are ~2MB (no thumbnails until Phase 3).
- No book UI yet (Phase 3) — archiving is verified at the data layer.

## Sign-off

Reply "Phase 2 live review passed" (or file what broke). Per PLAN.md §5,
Phase 3 starts only after this passes. (Phase 1's own live review is
still open too — this pass on the new transport covers its steps with
instant updates instead of ~2s polls.)
