# Noted — Product and Build Plan

Status: Accepted 2026-09-23 — the rebuild roadmap. Governed by `docs/decisions/0005-rebuild-on-clean-foundation.md` and the project `architect` skill. The v1 tree (prior plan, code, and learnings) is preserved behind the `archive/noted-v1` tag. Phase 0 (scaffold) starts on explicit go-ahead.

## Progress

- [ ] Phase 0 — Foundation scaffold
- [ ] Phase 1 — Noting core on the default theme
- [ ] Phase 2 — Per-home themes
- [ ] Phase 3 — Media (photo and voice)
- [ ] Phase 4 — AI themes
- [ ] Phase 5 — Hardening and deploy

## 1. Product vision

Noted is a shared family board for everyday notes. One home, one board: text, photo, and voice posts that members drag, open, edit, and grey out for one-hour shared Undo. Every home picks its own visual theme — a bundled scene, uploaded art, or AI-generated art constrained by a validated manifest — while the noting interaction stays identical everywhere. Web first; native shells later.

## 2. Foundation (settled, see ADR 0005)

- Shape references `create-t3-turbo`: pnpm + Turbo v2 pipeline, `apps/*` thin shells, `packages/*` single-responsibility (`api`, `db`, `validators`, `ui`, shared configs), CI mirroring the local gate.
- tRPC + zod + superjson is the only API definition; media uploads ride a small REST side-path.
- Tailwind for UI plus a small bespoke board-art layer; Drizzle for persistence; local Postgres for dev, Neon for deployment.
- Firebase Google auth behind a small server seam; shells own sign-in UI only.
- The `architect` skill gates every structural change. Headline rule: the repo follows a clear pattern — the v1 hand-written `api-client` shape must never return.
- Done criteria for the foundation: one-command setup works; one gate (types, lint, tests, build) green locally and in CI; tRPC end-to-end types with no duplicated client; boundaries documented and lint-enforced.

## 3. Learnings carried from v1

Keep: normalized 0..1 post coordinates; last-save-wins with per-operation membership checks; one-hour grey removal with shared Undo; server-anchored clock; preview-then-commit drags (no optimistic writes for shared data); generation-stamped operations; flat SVG fallback when art fails; themes as art plus validated manifest with fixed board/CSS slots; theme changes creator-only; posts keep colors across switches; uploads before AI generation; live two-account and physical-phone reviews gate every trust claim.

Banned: hand-written API clients; a single giant stylesheet; API contracts defined in more than one place; growth-decor complexity; per-theme geometry; bespoke framework-lets of any kind.

## 4. Phases

### Phase 0 — Foundation scaffold

Turbo tree, shared configs, pipeline plus CI mirror, Drizzle with local Postgres and migrations, dotenv env with typed validation, Firebase seam skeleton, Tailwind plus board-art skeleton, one-command setup documented. Exit: the foundation done criteria pass on an empty app, including a typed tRPC hello round-trip.

### Phase 1 — Noting core on the default theme

tRPC routers for homes, members, and posts with membership checks; board UI with text notes, drag, modal editing, slow removal with shared Undo, and polling; default theme art; seed and fixtures. Exit: playground plus shared-home text noting works end to end; two-browser check passes; gate green.

### Phase 2 — Per-home themes

Manifest schema in `validators`; themes table with private member-only art; default plus bedroom bundled themes proving the slot contract; creator select and apply; theme rides the board query. Exit: per-home switching works, posts keep positions and colors, members see changes on poll.

### Phase 3 — Media (photo and voice)

REST side-path uploads, private storage with lifecycle and pruning, playback UI. Exit: upload, attach, and prune verified; non-member access rejected.

### Phase 4 — AI themes

OpenAI port plus adapter with stub default; prompt-to-theme generation; vision-proposed manifests for uploads; preview-then-apply. Exit: bundled and upload paths work with no key; live-key generation verified by human eye (transparent surface, empty usable area).

### Phase 5 — Hardening and deploy

Hosting decision, Neon production database, rate and cost guards, content-moderation answer, live two-account and physical-phone reviews. Exit: deployed, reviews pass, foundation checklist holds on the new tree.

### Later (explicit non-goals)

Electron and Capacitor shells, map, activities, multi-board scenes.

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
- `https://developers.openai.com/api/docs/guides/image-generation`
- `https://developers.openai.com/api/docs/guides/structured-outputs`
- v1 tree and prior plans: `archive/noted-v1` tag (`PLAN.md`, `.agents/plans/2026-09-23-board-themes.md`)
