# Phase 1 live review — owner handoff

Implemented 2026-09-26. Gate green, 48 API checks green, seed + fixtures
done. The remaining exit item is the live two-browser pass, which needs
real Google sign-in (trust claims require live reviews, never emulation).

## One-time setup

1. Firebase console → project `noted-25f5b` → Project settings → Your apps:
   copy the web app config into `.env` (`NEXT_PUBLIC_FIREBASE_API_KEY`,
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
   `NEXT_PUBLIC_FIREBASE_APP_ID`). The server key is already filled from
   the preserved service account.
2. Authentication → Sign-in method: enable Google. `localhost` is an
   authorized domain by default.
3. Restart the dev server (`pnpm dev:web`) — web keys inline at start.
4. Sign in once, then seed (uid from Authentication → Users):
   `pnpm db:seed -- --email <you> --subject <uid>`.

## The two-browser pass

Browser A (account A) + a second browser or profile (account B):

1. A opens the seeded home; B signs in (sees no homes).
2. A invites B by email (Members panel); B reloads `/app` → home appears.
3. A adds a text note → it appears in B within ~2s (poll transport).
4. B drags the note → position lands in A within ~2s.
5. A removes the note → grey + countdown in both; B presses Undo → live.
6. A sticks a photo → visible in B; A archives it → gone from the board.
7. A revokes/removes or B leaves; access ends immediately.

## Known Phase 1 limits (not failures)

- ~2s delay on every shared update (polling; Phase 2 replaces it).
- Fixture photos are ~2MB (no thumbnails until Phase 3).
- Countdown is minute-precision display; the window is enforced server-side.
- No book UI yet (Phase 3) — archiving is verified at the data layer.

## Sign-off

Reply "Phase 1 live review passed" (or file what broke). Per PLAN.md §5,
Phase 2 starts only after this passes.
