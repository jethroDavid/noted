## Goal

Implement PLAN.md Phase 5 ("Persistent shared text notes") so that members of a real home share one persistent fridge: text notes are created, edited, moved, and slow-removed through the HTTP API and local PostgreSQL, with polling-based updates, last-save-wins saves, and server-authoritative one-hour removal with shared Undo. The public playground keeps working exactly as today (local fixtures, reset on refresh).

## Success Criteria

- Two signed-in browser sessions (two homes members) see each other's saved text notes and moves within one poll interval; reload preserves notes and positions.
- Concurrent content and position saves follow last-save-wins: a drag never overwrites text, an edit never overwrites position, and neither resurrects a pending-removal or expired post.
- Removal greys a note for all members for one hour (server deadline); any current member can Undo before expiry; at/after expiry reads omit the post, Undo fails, and edits/moves are rejected.
- Polling runs on the open fridge (~5s), plus refetch on focus/visibility/reconnect and after mutations; failures show a refresh banner without losing drafts or closing modals.
- An open modal draft and an active drag are never clobbered by an incoming poll; a failed save preserves the draft; a rejected move rolls back visually.
- A user who loses membership cannot read or change that home's posts on the next request, and the UI explains the lost access instead of spinning.
- `pnpm check` passes, DB integration tests pass with `RUN_DB_TESTS=1`, browser tests pass, and the manual two-account walkthrough (PLAN.md Phase 5 exit) succeeds.

## Context And Current Facts

- PLAN.md is the binding contract. Phase 5 checklist (PLAN.md Phase 5): connect fridge UI to HTTP API + local DB; create/edit, shared movement, newest-on-top, local selection, last-save-wins; polling with focus/reconnect + error states; one-hour pending removal, shared Undo, server-authoritative expiry. Exit: two sessions share via polling, reload preserves positions, concurrent-save rule holds, expiry/Undo work without a worker.
- Product rules already fixed: membership required for read/write (PLAN.md section 2); all members may edit/move/remove all posts; last-save-wins; text max 2,000 chars; normalized center coordinates with full-bounds clamping; one-hour recovery defined centrally; pending posts disable edit/drag, any member may Undo (PLAN.md sections 2, 3, 7, 9).
- Endpoint family proposed in PLAN.md section 7: `GET /homes/:homeId/boards/:boardId`, `POST .../posts`, `PATCH /homes/:homeId/posts/:postId`, `PATCH .../position`, `POST/DELETE .../removal`. Note the implemented Phase 4 routes use unversioned `/api/homes` (no `/v1`, no `/session`): see `apps/web/src/app/api/homes/route.ts`, `apps/web/src/app/api/homes/[homeId]/route.ts`, `apps/web/src/app/api/me/route.ts`.
- Database tables already exist: `boards`, `posts`, `media_assets` with the needed checks (`posts_normalized_position`, `posts_content_matches_kind`, `posts_deletion_pair`) and indexes (`posts_board_created_idx`, `posts_delete_after_idx`) are in `packages/database/src/schema.ts`; migration `0001` only re-applied FK constraints, so no base-table migration is needed for Phase 5.
- Pure rules available: `REMOVAL_RECOVERY_MS = 3_600_000`, `getRemovalDeadline`, `clampNormalizedCoordinate` in `packages/domain/src/index.ts`.
- Server patterns to mirror: services in `packages/server/src/homes.ts` throwing `ServiceError(status, message)`; queries in `packages/server/src/data/home-queries.ts` using Drizzle over the shared `database` pool; identity via `requireUser(request)` (Firebase Admin, verified Google account) in `packages/server/src/identity.ts`; routes use `export const runtime = "nodejs"`, `apiRoute`/`readBody` from `apps/web/src/features/api/route-utils.ts` (no-store, Zod 400 mapping).
- Client patterns to mirror: zod contracts in `packages/contracts/src/index.ts`; `createApiClient({ getIdToken })` with `ApiError(status, message)` and `ApiRequestOptions.signal` in `packages/api-client/src/index.ts`; web token callback in `apps/web/src/platform/api/home-api.ts` (reads current user per request, never cached).
- Frontend patterns to mirror (`docs/architecture/frontend.md`): feature folders under `features/<name>`; TanStack Query owns server state; query keys carry the account (`homes-keys.ts`); mutations write their exact response into cache with `setQueryData`, never refetch to confirm; `staleTime 15s`, `refetchOnMount false`, focus/reconnect refetch always, no auto-retry; one QueryClient per provider instance in component state, never module-level; named handlers, explicit `async/await`, no generic work/callback wrappers; `HomesProvider` owns one controller consumed via `useHomes()`.
- Current fridge UI: `FridgeApp` (`packages/fridge-ui/src/features/fridge/components/fridge-app.tsx`) owns local `posts` state seeded from `fixturePosts`, local selection (`postLayer` raises only locally), local 1s `now` ticker, and local removal/Undo/expiry via `board.ts` helpers (`isExpired`, `removalMinutes`, `clampPosition`, `positionFromDrag`, `createPost`, `BOARD_*`, `POST_SIZES`, `PAPER_COLORS`, `INK_COLORS`). Cards/modals are per-kind components sharing `PostCard` behavior and `PostModalFrame` (`docs/decisions/0002-fridge-interaction.md` still governs coordinates/layers/interaction; rendering is flat per `docs/decisions/0004-flat-fridge-render.md`). `TextPostModal` already enforces 2,000 chars and keeps the draft in local `useState(props.post)`.
- `HomeView` renders `FridgeApp` with `isPlayground={false}` inside `HomesProvider`; `HomePortal` keys views by account+home so stale views reset (`packages/fridge-ui/src/features/homes/components/home-view.tsx`, `home-portal.tsx`).
- Plant growth: `FridgeApp` currently counts local additions; the architecture guide requires that persistent mode record successful additions per home on the server and supply growth state (never infer from remaining posts).
- Validation patterns: DB integration test gated on `RUN_DB_TESTS=1` with uniquely-named temp records + cleanup (`packages/server/src/homes.test.ts`, README command); browser tests run a production server on port 3100 with mocked `/api/**` for home flows (`tests/browser/home-flows.spec.ts`, `tests/browser/home-session.ts`, `playwright.config.ts`); unit tests colocated (`vitest.config.ts` includes `packages/**/*.test.*`).
- Polling precedent: homes poll every 15s with a window-focus bridge in the controller (TanStack listens for visibilitychange, not focus). PLAN.md section 3 proposes a 5s fridge poll while visible + focus/reconnect refresh + error backoff.

## Constraints And Non-goals

- Text posts only. Photo/voice creation, upload, recording, playback, and media delivery stay Phase 6; the connected fridge must not offer media creation paths that silently do nothing.
- No WebSockets, Redis, cache layer, queue, or worker (Phases 8A-8D). Expiry is logical (reads exclude expired rows); no process must run at the exact deadline.
- No schema redesign: reuse the existing `posts`/`boards` tables and checks. The only migration is the small additions-counter column (see D8).
- No changes to invitation/membership semantics, home settings, or the playground's fixture behavior. `HomesProvider`/controller stay untouched except where explicitly wired (none planned).
- No `/v1` versioning migration, no `POST /session` endpoint, no palette/typography editor, no author/timestamp display on posts (all per PLAN.md).
- Physical-phone verification stays pending (carried from Phase 2); Phase 5 proves desktop + emulated touch, and the two-account live walkthrough still needs real Firebase accounts.

## Key Decisions

- D1 Endpoint shape: nest under the existing unversioned homes routes, keeping PLAN.md section 7's family: `GET /api/homes/[homeId]/boards/[boardId]`, `POST .../posts`, `PATCH /api/homes/[homeId]/posts/[postId]`, `PATCH .../posts/[postId]/position`, `POST/DELETE .../posts/[postId]/removal`. Rejected: introducing `/v1` now (churn with zero consumers needing it); rejected: omitting `boardId` from the read path (PLAN.md names board-scoped reads and it keeps the future room/board split intact).
- D2 Separate content vs position writes: content PATCH replaces text/colors only; position PATCH replaces coordinates only; each is a plain UPDATE (last-writer-wins, no version column). This is exactly PLAN.md section 7's rule that a drag must not overwrite text from a stale payload. Rejected: single full-row PATCH (reintroduces the clobbering PLAN.md forbids) and optimistic-lock rejection (PLAN.md explicitly selects no rejection for normal simultaneous edits).
- D3 Server time authority: board reads return `serverTime`; removal countdown display uses `deleteAfter - (localNow + serverOffset)`. Client timers are display-only; eligibility is decided by persisted deadlines in SQL. Rejected: trusting client clocks or client-computed remaining time.
- D4 Polling via the same TanStack mechanism as homes: `refetchInterval 5_000` (PLAN.md's proposed 5s), `staleTime 15_000`, `refetchOnMount false`, focus/visibility/reconnect refetch always, `retry false`, plus the same window-focus bridge. Interval polling also covers "refresh after mutations" only loosely, so mutations additionally write their exact response into the cache (the homes rule) rather than invalidating.
- D5 New `FridgePostsProvider` in `features/fridge` (own QueryClient in component state, own account subscription for scoped keys + prefix clearing, `api`/`homeId`/`boardId` via props). It lives inside `HomesProvider` (for `backToHomes()` on access loss) and wraps the connected fridge in `HomeView`. Rejected: stuffing posts into `useHomesController` (breaks feature ownership; the AGENTS.md rule keeps one controller per feature) and reusing the homes QueryClient (account-change clearing is prefix-scoped per feature).
- D6 `FridgeApp` becomes injectable: add an optional posts-source prop carrying posts, plant count, selection, busy/error, and named operations. Absent = today's local playground implementation, unchanged. Present = connected mode driven by `useFridgePosts()`. Rejected: a second fridge renderer (duplicates interaction code) and prop-drilling ten callbacks (the source object keeps the call sites readable).
- D7 Connected mode is text-only: the composer shows the Note button only (new prop, e.g. `availableKinds`), since photo/voice creation is Phase 6. Playground keeps all three buttons. Rejected: leaving media buttons visible-but-broken, and locally-faked media posts inside a real home (they would look shared but never persist).
- D8 Plant growth counter: add `boards.post_additions integer NOT NULL DEFAULT 0`, incremented in the create-post transaction, returned in the board response, mapped through existing `plant-growth.ts`. Satisfies the architecture guide's "record successful additions per home on the server" within the one-board-per-home model. Rejected: counting remaining posts (guide forbids) and a home-level column (the board is the read unit; equivalent while one board per home).
- D9 Color validation is 6-digit hex in contracts, not a palette enum: the UI offers `PAPER_COLORS`/`INK_COLORS`, the server accepts any `#rrggbb`. Keeps the palette adjustable per PLAN.md section 14 without contract churn. Text: trim, 1..2,000 chars (matches the modal). Coordinates: finite numbers in [0,1] (zod + existing DB check); the client clamps to kind-specific insets with `clampPosition` before sending.
- D10 Removal-state conflicts use `409` with distinct user-facing messages (edit/move on pending or expired post; repeated removal is idempotent success, not an error; Undo at/after expiry is `409`). One handling path in the client; no new status-code plumbing. Rejected: `410 Gone` for expired Undo (semantically nicer but a second path for one phase's worth of benefit).
- D11 Every post/board lookup joins through membership (`findBoardForMember`, `findPostForMember`); guessed ids yield `404` without leaking existence, exactly like `findHomeForMember`. Removal/Undo races use atomic conditional SQL (`UPDATE ... WHERE delete_after IS NULL / > now()`); repeated removal never restarts the deadline (PLAN.md section 9).
- D12 Ordering: server returns posts ordered by `(createdAt, id)`; the client assigns `order` by index for `postLayer`, so newest is on top and ties are stable. Selection stays purely local (no API call), per PLAN.md section 8.

## Recommended Approach

Follow the Phase 4 slice bottom-up, mirroring its files one layer at a time: contracts/domain -> database queries + counter migration -> server services -> api-client -> Next.js routes -> DB integration tests -> `FridgePostsProvider` + controller + keys -> `FridgeApp` injection refactor + text-only connected composer -> `HomeView` wiring -> mocked-API browser tests -> expiry-maintenance command -> docs/roadmap updates. Keep the playground pixel- and behavior-identical throughout; prove it with the existing `fridge.spec.ts` suite on every frontend unit. Each unit below is independently verifiable and lands with its tests.

## Work Plan

### Unit 1 - Post contracts and domain rules

- In `packages/contracts/src/index.ts` add: `boardIdSchema`/`postIdSchema` (uuid), `postTextSchema` (trim, min 1, max 2000), `hexColorSchema` (`^#[0-9a-fA-F]{6}$`), `normalizedCoordinateSchema` (finite, 0..1), `createPostSchema` (`{ text, foregroundColor, backgroundColor, x, y }`, kind fixed to `text`), `updatePostContentSchema`, `updatePostPositionSchema` (`{ x, y }`), `postSchema` (id, boardId, kind, text, colors, x, y, createdAt/updatedAt iso, `deletionRequestedAt`/`deleteAfter` nullable iso), `boardPostsResponseSchema` (`{ board: { id, homeId, postAdditions }, posts, serverTime }`).
- Domain: add a small `isExpiredByDeadline(deleteAfterIso, now)`-style helper only if both server and client need it; otherwise reuse `getRemovalDeadline`/`REMOVAL_RECOVERY_MS` and keep expiry comparisons in SQL + `board.ts`.
- Extend `packages/contracts/src/index.test.ts`: accept/reject vectors for text length/blank, hex colors, coordinates, and response parsing.
- Validation: `pnpm --filter @noted/contracts typecheck` (via `pnpm typecheck`), `vitest run packages/contracts`.

### Unit 2 - Additions-counter migration and post queries

- Schema: add `postAdditions` to `boards` in `packages/database/src/schema.ts`; run `pnpm db:generate`, inspect the SQL (one additive column, default 0), then `pnpm db:migrate` locally.
- New `packages/server/src/data/post-queries.ts` (Drizzle, same style as `home-queries.ts`):
  - `findBoardForMember(userId, homeId, boardId)` joining `homeMemberships -> homes -> boards` (D11).
  - `findBoardPosts(boardId)` returning non-expired posts (`delete_after IS NULL OR delete_after > now()`) ordered by `(createdAt, id)` plus `post_additions`; single DB `now()` for consistency.
  - `insertTextPost(...)` creating the post and incrementing `post_additions` in one transaction.
  - `updatePostContent / updatePostPosition` as conditional updates that only touch live posts (`delete_after IS NULL OR delete_after > now()`) and return whether a row was hit (drives 409 vs success).
  - `requestPostRemoval` setting `deletion_requested_at/delete_after` only when both are NULL (idempotent; never restarts); `undoPostRemoval` clearing both only when `delete_after > now()` (atomic race guard).
  - `pruneExpiredPosts(olderThan)` for Unit 11 (delete expired text rows; returns count).
- Validation: `pnpm db:migrate` from empty (`docker compose down --volumes` on a scratch checkout is NOT required; instead verify `drizzle-kit check` output if available), plus Unit 6 integration tests.

### Unit 3 - Post services

- New `packages/server/src/posts.ts`, exported from `packages/server/src/index.ts`, mirroring `homes.ts`:
  - `readBoard(user, homeId, boardId)` -> `{ board, posts, serverTime }` with membership check (404 otherwise).
  - `createTextPost(user, homeId, boardId, input)`; `editPostContent`, `movePost` (404 unknown/guessed, 409 pending-or-expired with distinct messages, D10); `requestRemoval` (idempotent 200 + post); `undoRemoval` (409 when already expired).
  - All timestamps from the database transaction time where practical; `updatedAt` touched on content/position writes.
- Pure unit tests for message/status mapping where logic lives outside SQL; SQL behavior is covered in Unit 6.
- Validation: `pnpm --filter @noted/server typecheck`, `vitest run packages/server` (non-DB).

### Unit 4 - API client methods

- Extend `createApiClient` in `packages/api-client/src/index.ts`: `boardPosts(homeId, boardId)`, `createPost(homeId, boardId, input)`, `editPost(homeId, postId, input)`, `movePost(homeId, postId, x, y)`, `requestRemoval(homeId, postId)`, `undoRemoval(homeId, postId)`; all accept `ApiRequestOptions` and validate with the Unit 1 schemas.
- Extend `packages/api-client/src/index.test.ts` with mocked-fetch tests for paths, methods, bodies, and `ApiError` message extraction (409 path included).
- Validation: `vitest run packages/api-client`.

### Unit 5 - Next.js routes

- Add routes (all `export const runtime = "nodejs"`, `requireUser`, `apiRoute`/`readBody`, zod param parsing, no-store via shared helper):
  - `GET apps/web/src/app/api/homes/[homeId]/boards/[boardId]/route.ts`
  - `POST apps/web/src/app/api/homes/[homeId]/boards/[boardId]/posts/route.ts` (201)
  - `PATCH apps/web/src/app/api/homes/[homeId]/posts/[postId]/route.ts`
  - `PATCH apps/web/src/app/api/homes/[homeId]/posts/[postId]/position/route.ts`
  - `POST` + `DELETE apps/web/src/app/api/homes/[homeId]/posts/[postId]/removal/route.ts`
- Validation: `pnpm --filter @noted/web typecheck`, `pnpm build`; behavior proven in Units 6 and 10.

### Unit 6 - Server DB integration tests

- New `packages/server/src/posts.test.ts`, same harness as `homes.test.ts` (`test.skipIf(RUN_DB_TESTS !== "1")`, `syncVerifiedUser` Alice/Bob/Carol, unique suffix, cleanup in `finally`):
  - Create/edit/move round-trip; reload-equivalent reread preserves positions; newest-first ordering with stable ties.
  - Last-save-wins: content edit after a move keeps the moved coordinates and vice versa (separate-payload proof).
  - Home isolation: Carol gets 404 on board/posts; guessed post id as Bob gets 404.
  - Removal: request greys (timestamps set), repeat request keeps the original deadline, member (Bob) Undo clears, edit/move while pending get 409.
  - Expiry without waiting: set `delete_after` to the past via SQL, then reads omit the post, Undo/edit/move get 409 (restart-equivalence: fresh queries, no in-memory state).
  - Removal/Undo race: fire both concurrently (`Promise.all`) and assert exactly one outcome wins cleanly (no error above 409, post either live or pending, never half-written).
  - Counter: two creates increment `post_additions` by 2; edits/moves/removal/Undo leave it unchanged.
- Validation:
  ```powershell
  $env:RUN_DB_TESTS='1'
  node --env-file=.env node_modules/vitest/vitest.mjs run packages/server/src/posts.test.ts
  ```

### Unit 7 - FridgePostsProvider, keys, query client, controller

- New files in `packages/fridge-ui/src/features/fridge/state/`: `posts-keys.ts` (`fridgePostsPrefix`, `boardPostsKey(accountId, homeId, boardId)`), `posts-query-client.ts` (`makeFridgePostsQueryClient`: `retry false`, `staleTime 15_000`, `refetchOnMount false`, focus/reconnect always, `refetchInterval 5_000`), `use-fridge-posts-controller.ts`, `fridge-posts-context.ts`, `fridge-posts-provider.tsx`, `use-fridge-posts.ts`; export the provider + hook from `features/fridge/index.ts` and the package root as needed.
- Controller (mirrors `use-homes-controller.ts` structure, no Firebase/Next imports):
  - Props: `api: NotedApiClient`, `auth: HomesAuth`, `homeId`, `boardId`. Subscribes to `auth` for `accountId`; on account change clears the `fridgePosts` prefix (same stamp/generation pattern as homes for late-result drops after navigation).
  - One `useQuery` for the board; named mutations for create/edit/move/removal/Undo that `setQueryData` their exact response (map server post into the cached list; update `postAdditions` from create responses).
  - Window-focus bridge identical to homes. `retry()` for initial-error mode; refresh banner state when background polls fail with cached data; `backToHomes()` passthrough need: expose `accessLost` boolean and let `HomeView` call `useHomes().backToHomes()` (provider nesting gives access to both hooks).
  - Server-time offset: store `serverTime - Date.now()` from the latest board fetch; expose `now()` for `removalMinutes` display so countdowns track the server deadline.
  - Drag-safety: expose a `previewMove`/`commitMove` pair or document that drag preview stays in `FridgeApp`-local state and only release calls `movePost` (Unit 8 implements the local side).
- Colocated tests: keys test (account scoping), controller test with mocked api/auth covering write-into-cache, account-change clearing, 409 surfacing, and access-lost flag (mirror `use-homes-controller.test.tsx`).
- Validation: `vitest run packages/fridge-ui`, `pnpm --filter @noted/fridge-ui typecheck`, plus the lint boundary check (`pnpm lint`).

### Unit 8 - FridgeApp injection refactor + connected behaviors

- Define a `FridgePostsSource` type (posts as client `Post[]`, `postAdditions`, selection, `busy`, `error`, `accessLost`, `retry`, named operations `addText/save/move/remove/undo`, `serverNow`) in `features/fridge/state/`.
- Refactor `FridgeApp`: optional `source` prop. When absent, keep the exact current local implementation (playground). When present: render from `source.posts`, countdowns from `source.serverNow()`, composer limited by a new `availableKinds` prop (`["text"]` in connected mode), empty/error/access-lost states, refresh banner via `notice`.
- Drag in connected mode: pointer preview stays in `FridgeApp`-local state (`dragPreview` id+position merged at render); `positionFromDrag`+`clampPosition` still compute the payload; release calls `source.move`; on `false` the preview is discarded (rollback) and the banner shows the error. Polls only touch the query cache, never the preview or the modal draft.
- Modal draft safety: `TextPostModal` already seeds `useState(props.post)` once; keep `key={editor.post.id}` stable across polls and add a regression test that a poll-equivalent prop update does not reset the draft (jsdom test or browser test in Unit 10).
- Modal error display: extend `PostModalFrame` with an optional `saveError` string + keep-draft-on-failure behavior (save returns boolean; `false` keeps the modal open with the message).
- Pending posts: reuse the grey styling + `PostModalFrame` pending footer; disable edit/drag from `removedAt !== null` exactly as today, now driven by server `deleteAfter`.
- Validation: existing `tests/browser/fridge.spec.ts` must pass unmodified (playground proof); new jsdom tests for draft preservation and drag-preview merge.

### Unit 9 - HomeView wiring

- In `HomeView`: read `home` from `useHomes()`; wrap `FridgeApp` in `FridgePostsProvider` (`api` + `auth` re-supplied from the web shell — extend `WebHomeApp` props or a small context so `HomeView` can pass the same stable instances it already receives via `HomesProvider`), `homeId={home.id}`, `boardId={home.boardId}`; pass `availableKinds={["text"]}`, connect `notice`/`overlay` (access-lost view offers "Back to homes").
- `HomePortal` keys already reset per account+home; verify no stale-post flash when switching homes (covered in Unit 10).
- Update `docs/architecture/frontend.md` folder map + a short "posts ownership" paragraph mirroring the homes section.
- Validation: `pnpm build`, `pnpm test:browser` (existing suites), manual single-home smoke in `pnpm dev`.

### Unit 10 - Browser tests for shared posts (mocked API)

- New `tests/browser/fridge-posts.spec.ts` following `home-flows.spec.ts` (intercept `**/api/**`, `installBrowserSession`):
  - Open home shows server posts (not fixtures); create/edit/move/remove/Undo round-trips hit the expected endpoints with clamped coordinates and surface responses.
  - Poll proof: count `GET boards` requests; change the mock payload after the first poll; assert the second session's note appears without interaction (5s interval keeps this fast).
  - Draft/drag safety: open modal, trigger a poll payload change behind it, assert draft text untouched; failed save keeps modal + draft + error.
  - Membership revoked: mock 404 on board fetch, assert the access-lost message and working "Back to homes".
  - Home switch: switch selected home, assert the previous home's posts never render (stale-response guard).
- Validation: `pnpm build`, `pnpm test:browser` (full file, desktop + touch projects).

### Unit 11 - Expired-post maintenance command (small)

- Add a `pruneExpiredPosts` server export + a database-package script (tsx, `--dry-run` flag, explicit "deletes text posts with `delete_after <= now()`" rule; media-aware cleanup stays Phase 6/8D). Wire as `pnpm db:prune-expired`. Isolated test: insert an expired + a live post, run in dry-run (no change) then for real (only expired removed). This is the PLAN.md section 9 maintenance command, not a worker.
- Validation: the isolated test + `pnpm db:prune-expired -- --dry-run` against local DB.

### Unit 12 - Docs and roadmap

- PLAN.md: check the four Phase 5 boxes, update the status table row + "Current progress" paragraph, record verification evidence (command outputs, browser versions) in the Phase 5 section like Phase 4 does.
- README: update "posts inside shared homes are still fixtures" wording, polling/Undo behavior, and the two-account walkthrough to include posting from both accounts.
- `docs/architecture/frontend.md`: folder map + posts-ownership paragraph (done in Unit 9; verify here).
- Validation: `pnpm format:check` (docs are prettier-checked), full `pnpm check`.

## Validation Plan

- Per-unit gates are listed above; the binding order is: contracts tests -> migration -> services -> api-client tests -> routes build -> `RUN_DB_TESTS=1` posts suite -> fridge-ui unit tests + lint boundary -> playground browser suite unmodified -> new posts browser suite -> full `pnpm check`.
- Final gates (all must pass before the phase is declared complete):
  1. `pnpm check` (format, lint, types, unit tests, production build).
  2. `$env:RUN_DB_TESTS='1'; node --env-file=.env node_modules/vitest/vitest.mjs run packages/server/src/posts.test.ts` (and re-run `homes.test.ts` to prove no regression).
  3. `pnpm build; pnpm test:browser` (existing + new suites, desktop and touch).
  4. Manual two-account walkthrough with real Firebase (PLAN.md exit): Alice creates/posts, Bob sees via polling and moves/Undoes, reload preserves state, Carol (nonmember) gets 404-equivalent UI, Bob leaves and loses access. Highest-risk step: the live two-account poll + Undo timing against real auth; run it last, on `pnpm dev:all`, and record the outcome in PLAN.md before checking boxes.

## Risks / Rollback

- Risk: poll writes clobbering in-flight edits. Mitigation: D2's split payloads, local-only drag preview + modal draft, mutation responses written directly to cache. Proven by Unit 6 (payload separation) and Unit 10 (draft/drag safety).
- Risk: clock skew confusing the Undo countdown. Mitigation: server-time offset for display, SQL deadlines for eligibility. Proven by Unit 6 expiry tests.
- Risk: stale posts flashing after home switch or sign-out. Mitigation: account+home scoped keys, prefix clearing on account change, `HomePortal` key resets. Proven by Unit 10 home-switch test.
- Risk: migration breaking existing local DBs. Mitigation: purely additive column with default; `db:generate` output inspected before applying. Rollback: drop the column migration and revert to fixture fridge (Units 7-9 are additive behind the `source` prop; playground works with the provider absent).
- Risk: live Firebase walkthrough blocked (the carried Phase 4 gate). Mitigation: all automated gates use mocks/local DB and can complete first; the manual walkthrough is the last checkbox, and its pending state is recorded in PLAN.md rather than holding the code.

## Open Questions

None. All Phase 5 behaviors (membership, last-save-wins, polling defaults, removal mechanic, limits, endpoint family, validation strategy) are specified in PLAN.md sections 2, 3, 7, 9, 11, and 13, and the code patterns to mirror were verified in the workspace sources cited above.
