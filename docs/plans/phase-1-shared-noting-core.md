# Phase 1 — Shared noting core (worked-out details)

Started 2026-09-26. PLAN.md §4 fixes the scope; this note works out the
details (§5: "phase details are worked out when each phase starts").
Carried interaction model: v1 (`archive/noted-v1`) semantics for membership
checks and clocks; delete is instant with a 10-second Undo toast (the v1
grey-removal window was dropped per owner direction 2026-09-26); tRPC +
zod is the only API definition.

## Scope

- Google auth (Firebase client sign-in; server seam verifies ID tokens in
  tRPC context; verified users upserted, email invitations claimed).
- Homes + members + invitations (creator manages, members note).
- Fridge text notes: create, modal edit, drag move, instant delete with a
  10-second Undo toast (exact-snapshot restore). Last-save-wins;
  per-operation membership checks.
- Fridge photo notes: created from bundled fixtures (uploads + S3 land in
  Phase 3); removal instantly archives to the book store with a 10-second
  Undo toast, like text notes (Undo restores the exact snapshot to the
  board and consumes the book entry). Nothing lost either way (Phase 3
  book UI recovers un-undone photos).
- Temporary refetch transport (polling; removed in Phase 2).
- Seed + fixtures: bundled fridge photos, sample reels, starter notes.
- Book UI, reels UI, uploads, workers: explicitly Phase 3.

## Data (`packages/db`)

Port the v1 schema minus voice: `users`, `homes`, `home_memberships`,
`home_invitations`, `boards` (fridge), `media_assets` (kind `photo`;
`(homeId, storageKey)` unique so fixture rows are per-home lazy),
`posts` (kind `text` | `photo`), plus new
`book_entries` (the Phase 3-readable archive store). Drop `heartbeat`.

Seed (`db` package, `seed` turbo task via tsx):
`pnpm db:seed -- --email <owner> --subject <firebase-uid>` creates the
user, a "Family Kitchen" home + board, starter notes, one photo note, and
one archived photo. Idempotent per creator home name.

## API (`packages/api` + `packages/validators` + `packages/domain`)

- New `packages/domain` leaf (v1 parity): removal window, deadline helper,
  coordinate clamp. Validators stays pure zod (leaf rule); `api` and `web`
  import domain; lint zones extended.
- `packages/auth` seam grows from `{uid, email} | null` to verified
  identity (email verified + google.com provider, like v1) with typed
  failures; user sync stays in `api` (auth keeps zero internal deps).
- Context carries the verified app user (upsert + claim invitations per
  request, as v1); `protectedProcedure` rejects anonymous callers.
- Services throw `TRPCError`: 404 hides non-member resources and missing
  posts; kind-mismatched ops 400; restore is idempotent.
- Routers: `me.get`; `homes.list/create/get/rename/invite/revokeInvitation/
removeMember/leave`; `boards.get/createText/createPhoto/editContent/move/
removePost/restorePost` (one kind-agnostic removal and Undo; the server
  branches on the stored kind). Board read returns
  `{board, posts, serverTime}`; photo posts resolve fixture URLs.

## Web (`apps/web`, `packages/ui`)

- Firebase client sign-in + `AuthProvider`; tRPC `authorization` header via
  async `getIdToken()`; unconfigured state when web keys are missing.
- Routes: `/` (sign in), `/app` (homes), `/app/homes/[homeId]` (board +
  members panel for invite/revoke/remove).
- Board: fixed kitchen scene in `BoardStage` (extracted v1 art, flat
  fallback when art fails); draggable cards with preview-then-commit;
  text modal; fixture photo picker; instant delete with a 10-second
  Undo toast; refetch-interval transport.
- Board components live in app features (single shell in the demo);
  `packages/ui` keeps primitives + the scene stage.

## Fixtures (`apps/web/public/fixtures`)

Fridge photos + kitchen art extracted from `archive/noted-v1`; sample
reels fetched as small public sample clips (fallback: manifests + posters
if the fetch is blocked, bytes deferred to Phase 3 which owns reels).

## Exit

- `pnpm check` green (gate mirrors CI).
- API-level end-to-end against local Postgres: seed, board ops, removal /
  Undo windows, photo archive, non-member rejection.
- Two-browser shared noting with two Google accounts: needs the owner's
  Firebase web keys (`NEXT_PUBLIC_FIREBASE_*` for project `noted-25f5b`)
  plus a live pass; recorded as the remaining live review, not emulation.
