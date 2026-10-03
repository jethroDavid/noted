# Phase 3 live review — owner handoff

Implemented 2026-09-28. Gate green (66 tests), probe green (30
caller-level checks over the true worker HTTP loop: photo upload →
thumbnail → board playback, reel upload → poster → feed playback,
remove-to-book, book + reel delete with blob cleanup, fan-out to a
second viewer, revocation). The remaining exit item is the live
two-browser pass, which needs real Google sign-in (trust claims require
live reviews, never emulation).

Local media runs under plain `next dev`: the QStash dev server starts
itself on the first upload (port 8080; downloads its binary once, so
the first upload needs network), signs deliveries with deterministic
dev keys, and posts to the Next worker routes. No tokens, no extra
processes. If uploads stick but variants never arrive, the worker loop
(dev server → `/api/workers/*` → MinIO → Postgres) — not the UI — is
broken.

## One-time setup

1. `docker compose up -d` (Postgres + Redis + MinIO), `pnpm db:migrate`.
2. `pnpm dev:web` (Next on http://localhost:3000).
3. Machine check (new terminal, repo root):
   `pnpm exec dotenv -e .env -- tsx .local/scratch/phase3-e2e.ts` →
   `Phase 3 probe: all checks passed.`
   Destructive: it wipes all homes/users first, so run it BEFORE
   seeding real accounts. If it fails, the media pipeline — not the
   browser UI — is broken.
4. Sign in once, then seed (uid from Authentication → Users):
   `pnpm db:seed -- --email <you> --subject <uid>`.

## The two-browser pass

Browser A (account A) + a second browser or profile (account B, invited
by email via the Members panel as in Phase 2):

1. Both open the home: Fridge / TV / Book tabs, pills show Live.
2. TV tab: two seeded fixture reels play inline (no posters — `<video>`
   shows the first frame). A uploads a clip (+ Upload reel, mp4/webm
   ≤100MB) → it appears in B's feed at once, playing the original;
   within seconds the poster lands in both without a reload.
3. Fridge tab: A sticks a photo (+ Photo → Upload a photo, jpeg/png/webp
   ≤10MB) → it lands on B's board at once, full-size; within seconds
   both swap to the thumbnail (same picture, smaller bytes).
4. A removes the uploaded photo from the fridge → it vanishes in both
   instantly, and appears in both Book tabs (no reload: Book refetches
   on the media event). B opens it (full-size modal).
5. B presses Delete forever → the entry leaves both Books at once. Blob
   check: `docker exec noted-minio-1 mc ls local/noted-media/homes/ --recursive`
   (one-time alias setup:
   `docker exec noted-minio-1 mc alias set local http://localhost:9000 noted notednoted`)
   → no keys under the deleted asset's folder remain.
6. A moves the uploaded reel to the photobook (⋯ menu → Move to
   photobook) → it leaves both TVs at once and appears in both Books;
   its blobs stay (the book entry still references the asset). B deletes
   it forever from the book → its blobs go too (same `mc ls` check).
7. A removes B (Members panel) → B's TV/Book flip to "Home not found"
   at once.

## Known Phase 3 limits (not failures)

- Upload caps: photos 10MB, videos 100MB — larger files are rejected
  with an error, not retried or resumed.
- The QStash dev server prints its banner into the terminal that made
  the first upload (dev server or probe), not the browser console.
- A lost process job leaves the original visible (by design, logged);
  a lost cleanup job leaves orphan blobs (by design, logged).
- Already-rendered bytes outliving a revocation is accepted: a refetch
  rechecks and 404s.
- No captions, likes, comments, book restore-after-window, or
  pending-upload sweeper (all out of scope per the plan).

## Sign-off

Reply "Phase 3 live review passed" (or file what broke). Per PLAN.md §5,
Phase 4 starts only after this passes. (Phase 1's and Phase 2's live
reviews are still open too — this pass covers the media half of the
product on the Phase 2 transport.)
