# Phase 2 — Realtime backbone (worked-out details)

Started 2026-09-26. PLAN.md §4 fixes the scope; this note works out the
details (§5: "phase details are worked out when each phase starts").
Transport: tRPC subscriptions over SSE (EventSource) on the same
`/api/trpc` route as queries — plain HTTP streaming, no upgrade API, no
beta, works in `next dev` and on Vercel; Redis pub/sub rooms for
cross-instance fan-out; board-read cache with event invalidation;
temporary polling removed. (An earlier WebSocket revision via
`experimental_upgradeWebSocket` was implemented and superseded the same
day: SSE is equally capable for one-way event taps and carries no beta
or CLI/login cost.)

## Scope

- Subscriptions ride SSE on `/api/trpc` (tRPC `httpSubscriptionLink`
  with the browser's native EventSource); queries and mutations stay on
  the same route over `httpBatchLink` (split link). No socket route.
- Redis pub/sub rooms plus fan-out, board-read cache with mutation
  invalidation, and minimal board presence (who is viewing).
- Client reconnect with resubscribe plus state reload: EventSource
  reconnects natively, each reconnect re-runs the subscription from
  scratch, and the client's onStarted refetch heals any gap.
- Compose gains local Redis; `REDIS_URL` wired (local compose default,
  Upstash TLS endpoint in production).
- Polling removed. Phase 1's live review stays open and is re-run on
  this transport (its "~2s (poll)" steps become instant).

## Decisions

- New `packages/realtime` leaf (architect skill: no package grows a
  second job, so Redis does not join `db`): room pub/sub, board cache,
  and presence over ioredis. Depends on nothing internal; `api`
  imports it. Lint zones extended.
- Events are invalidation signals, not patches: `{type:
"board-changed", boardId}` makes every subscriber refetch, and the
  refetch is served from the Redis cache. Moves are commit-on-release,
  so invalidation traffic is trivial. Schema lives in `validators`.
- Subscription re-checks home membership before yielding each event,
  so a revoked member's stream ends immediately (Phase 1's "access
  ends immediately" holds over the stream too).
- Publish + cache-invalidate happen in `api` services after commit, so
  every caller (any transport) fans out. A Redis failure degrades to
  staleness (logged, mutation still succeeds); the next reconnect
  reloads state.
- Presence is a Redis sorted set of last-beat timestamps per board
  viewer, refreshed by a `heartbeat` mutation every 20s and pruned on
  read; join/leave publish immediately, so viewers converge fast.
- Auth: EventSource GETs cannot set headers, so the client sends its
  Firebase ID token as connection params (parsed from the query string
  into `info.connectionParams`); queries and mutations keep the
  `Authorization` header. One context function reads both.
- No `tracked()` replay: reconnect does a full state reload instead of
  replaying missed events (durable log is out of scope).
- SSE needs no CLI: local realtime runs under plain `next dev`, and
  the same streaming response serves on Vercel. `maxDuration`, pool
  attachment, and connection-limit verification stay with Phase 4
  production wiring, which has a live target to verify against.
- Members-panel realtime is out of scope (unchanged Phase 1 behavior:
  the actor's own mutations invalidate; others see changes on reopen).
- Removing or leaving a member publishes immediately, so the ex-member's
  stream rechecks and ends at once; the client refetches into the "Home
  not found" screen on subscription or heartbeat failure.

## Data flow

Mutation (HTTP) → service commits to Postgres → publishes
`board-changed` to `board:{boardId}` + deletes the board cache key →
every subscribed instance's `boards.onEvent` yields (after membership
recheck) → clients invalidate the board query → refetch hits the
rebuilt Redis cache. Presence heartbeats publish viewer snapshots on
the same channel.

## Exit

- `pnpm check` green (gate mirrors CI; CI test job gains a Redis
  service).
- Maintained tests: event-schema round-trips, pub/sub fan-out, cache
  set/get/invalidate, presence join/beat/prune/leave — all against
  real Redis, no fakes — plus the SSE bridge (streaming, anonymous
  rejection, and bogus-token rejection over real HTTP, no fakes).
- `.local/scratch/phase2-e2e.ts` probe (not a gate, mirrors Phase 1):
  caller-level subscription delivery, cache behavior, presence, and
  revocation mid-stream through fabricated contexts.
- Live two-browser review under `next dev`: instant shared updates, the
  reconnect drill (kill + resume resubscribes and reloads), cache hits
  observed in Redis. See `phase-2-live-review.md`.
