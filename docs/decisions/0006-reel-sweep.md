# Reel sweep: expiry plus photobook archive

Date: 2026-10-03

Status: Accepted (Phase 3 follow-up; production schedule lands with Phase 4 cloud wiring)

## Context

TV reels lived forever until manually deleted (`media.deleteReel`), and the
`expired` media state sat unused. The owner wants reels to behave like real
reels: they leave the TV feed after a fixed window and archive into the
photobook as playable clips.

## Decisions

### D1. Fixed window, archive on expiry — SETTLED 2026-10-03

Reels leave TV 7 days after creation (`REEL_LIFETIME_MS` in `domain`, one
constant shared by the API, the worker, and the UI countdown). Ready reels
archive to `book_entries`; never-ready ones are discarded like `removePost`'s
never-ready photos. No restore-to-TV path (non-goal).

### D2. Scheduled global job — SETTLED 2026-10-03

A `sweep-reels` queue job with a global envelope (no homeId) runs the sweep.
Mutation-time publishes stay as they are; this job is invoked by a QStash
Schedule (cron) POSTing the envelope to the thin
`/api/workers/sweep-reels` route, which verifies and parses exactly like the
other worker routes. The handler resolves homes by lookup, moves each reel
inside one delete-guarded transaction (safe under retry and overlapping
runs), and emits `media-changed` per affected home. Rejected: Vercel Cron
(new config surface), lazy expiry on read (clips would vanish before
reaching the book), self-perpetuating delay chains (bespoke scheduler).

### D3. Clip-shaped book entries — SETTLED 2026-10-03

`bookEntrySchema` is a `photo | clip` discriminated union. Clips carry the
video asset's poster and original; the photobook shows a poster tile with a
play badge and plays the clip in the shared modal. `Delete forever` works
for both kinds unchanged. The sweep records `archivedFromReelId` and the
reel creator as `archivedByUserId` (the column is NOT NULL and there is no
acting user).

### D4. Fixtures never sweep — SETTLED 2026-10-03

Seed fixture reels are permanent sample content. The sweep excludes them by
the same `fixtures/` prefix rule as variant cleanup, and the API serves them
a null `expiresAt` so TV shows no countdown.

### D5. Manual delete archives too — SETTLED 2026-10-03

Deleting a reel from the TV (⋯ menu → Move to photobook) archives it like
the sweep instead of destroying it: ready reels become clip entries,
never-ready ones are discarded with their orphaned asset. Both paths share
one removal helper; the sweep records the reel creator as archiver, manual
delete records the acting user. Permanent deletion happens only via the
book's Delete forever.

## Ops

Create the schedule once per production deploy (Phase 4): destination
`{APP_URL}/api/workers/sweep-reels`, cron `0 3 * * *`, body
`{"job":"sweep-reels"}` (Upstash console or `POST
/v2/schedules/{destination}` with `Upstash-Cron`). Local dev has no
schedule; trigger via the `.local/scratch/sweep-verify.test.ts` probe.
