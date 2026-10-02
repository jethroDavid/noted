# Phase 3 — TV reels, photo book, media pipeline (worked-out details)

Implemented 2026-09-27–28. PLAN.md §4 fixes the scope; this note
works out the details (§5: "phase details are worked out when each
phase starts"). Gate green (66 tests), probe green (30 checks over the
true worker HTTP loop); live two-browser review pending — see
`phase-3-live-review.md`.
S3 presigned uploads (MinIO locally, managed S3 in Phase 4); QStash
publishers plus HTTP API-route workers (the QStash dev server signs and
delivers locally, no tokens); sharp photo thumbnails; ffmpeg reel
posters; variant cleanup on removal; reels feed UI; book archive UI;
remove-to-book flow end to end.

Sequencing waiver: Phase 2's live two-browser review is still open, and
PLAN.md §5 says no phase starts until the previous phase's exit passes.
Phase 3 implementation starts on the owner's explicit instruction anyway;
its own exit still requires its live review, and the Phase 2 pass stays
open alongside.

## Scope

- `packages/media` (new leaf): S3 object storage (client, presigned
  PUT/GET, head/get/put/delete, ensureBucket), uuid key layout, variant
  generation (sharp thumbnails, ffmpeg posters). Own env validation.
- `packages/queue` (new leaf): zod job envelope schemas, publishers
  (QStash cloud in production, the QStash dev server in dev/test — same
  SDK, same signatures, no tokens), worker request verification. Own env
  validation.
- Upload flow: `media.requestUpload` mints a pending asset plus a
  presigned PUT ticket; the client PUTs bytes straight to S3; attaching
  (`boards.createUploadedPhoto`, `media.createReel`) verifies the bytes,
  flips the asset to attached, and publishes the process job. No
  separate complete call: attach is completion.
- Workers as thin API routes (`/api/workers/process-media`,
  `/api/workers/cleanup-media`): verify signature, parse the queue
  envelope, call the `api` media service. All logic lives in the
  service; routes never touch SQL or S3 directly.
- Reels feed UI (TV), book archive UI, photo-picker upload section, and
  Fridge/TV/Book tabs on the home page. Shared upload client in
  `features/media`.
- Seed plants two fixture reels per home. Fixture reels need no posters:
  `<video preload="metadata">` shows the first frame until an uploaded
  reel's worker-made poster arrives.
- Polling stays removed: TV and Book subscribe to home-scoped media
  events over the Phase 2 SSE transport and refetch on change.

## Decisions

- One attach per asset: attach requires state `pending`, so every
  uploaded asset backs exactly one post or reel. Fixture assets stay
  shared (`attached`, lazy rows) and are never processed.
- Events are invalidation signals, as in Phase 2: `{type:
"media-changed", homeId}` on a new `home:{homeId}` room makes TV/Book
  subscribers refetch. `removeMember`/`leaveHome` publish it too, so an
  ex-member's media stream rechecks and ends at once. Membership is
  rechecked before each yield, mirroring `boards.onEvent`.
- Processing publishes back into the UI: the process worker emits
  `board-changed` for an attached board photo (swaps the original for
  the thumbnail) and `media-changed` for a reel (poster arrival).
- Reads mint fresh presigned GETs after the membership check, so
  non-member access is rejected at read time. URLs live 1 hour — far
  above the 60s board-cache TTL, so cached reads never serve dead URLs.
  Already-rendered bytes outliving a revocation is accepted and
  documented (a refetch rechecks and 404s).
- Fixtures stay public and full-size under `/fixtures`; only `homes/`
  keys are ever deleted. The cleanup worker skips any other prefix, and
  asset rows are deleted only when no post, reel, or book entry
  references them (fixture rows re-create lazily on next use).
- Publishing is fail-open (logged, mutation still succeeds), matching
  the repo's Redis philosophy: a lost process job leaves the original
  visible (thumbnails fall back to the original URL); a lost cleanup
  job leaves orphan blobs. No silent success: every loss is logged.
- QStash needs a public URL, so dev/test run the QStash dev server:
  the SDK downloads and spawns it on first use (port 8080), publishes
  through it, and signs deliveries with deterministic dev keys that the
  same Receiver verifies — no tokens, no bespoke seam, no code changes
  between dev and production. Only `QSTASH_TOKEN` selects the cloud
  path. Verification is real in every environment; without signing
  keys, production refuses worker calls while dev verifies against the
  dev keys.
- Upload caps live in `domain` (shared by API and app): photos 10MB
  (jpeg/png/webp), videos 100MB (mp4/webm). Avatars of scope: no
  captions, likes, comments, book restore-after-window, video
  dimensions, upload resume, or pending-upload sweeper (`expired` stays
  unused). Cloud-mode publishing (a real QStash token) and managed S3
  wiring verify live in Phase 4, which has targets to verify against.

## Data flow

Upload: requestUpload (ticket) → client PUT to S3 → attach verifies via
headObject → post/reel row + event → process job → worker downloads the
original, writes variants to S3, updates the asset row → completion
event → subscribers refetch presigned variant URLs. Removal: book/reel
delete removes rows, publishes `media-changed`, and queues blob cleanup
by key.

## Env

`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY` (MinIO defaults locally); `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (unset locally
— direct mode); `APP_URL` (worker base in production);
`WORKER_BASE_URL` (dev override, defaults to localhost:PORT). All join
`turbo.json` globalEnv and `.env.example`; `media` and `queue` validate
their own, following `auth`.

## Exit

- `pnpm check` green (gate mirrors CI; CI test job gains a MinIO
  service alongside Redis).
- Maintained tests, all against real MinIO, no fakes: presigned
  PUT/GET round-trips, thumbnail and poster generation from the bundled
  fixtures, fixture-prefix cleanup skip, queue envelope validation,
  dev-mode signed delivery to a stub server (real publish + verify
  round-trip), worker verification matrix, media validator schemas.
- `.local/scratch/phase3-e2e.ts` probe (not a gate, mirrors Phase 2):
  photo upload → process → board playback, reel upload → process →
  feed playback, remove-to-book, book delete → blobs gone, media event
  delivery to a second viewer, non-member rejection. Needs Postgres +
  MinIO + the dev server (the true worker HTTP loop).
- Live two-browser review: instant uploads across browsers, TV
  playback, book archive and permanent delete, cache/URL behavior.
  See `phase-3-live-review.md`.
