## Goal

Pivot Noted from one hardcoded fridge illustration to per-home selectable board themes: the board layout and CSS stay fixed (the cardboard doll), while the artwork swaps (the cardboard dresses). Sources are bundled themes, creator uploads, or AI generation. The noting interaction does not change.

## Success Criteria

- One documented slot contract (stage, surface rect, safe insets) renders both the cream fridge and the bedroom nightstand without per-theme CSS.
- No fridge-specific names remain for shared concepts in code, docs, or assets; plant growth decor is removed everywhere.
- A creator can set a bundled theme per home; every member sees the same scene on the next poll; posts, colors, and positions survive theme switches.
- A creator can upload art and get a validated theme, or enter a prompt and get OpenAI-generated art plus a manifest; bundled and upload paths work with no AI key configured.
- `pnpm check`, the focused unit suites, the DB integration suites, and the updated browser suite all pass.

## Context And Current Facts

- Fixed geometry is the de facto contract today: 7:10 stage, `.board-surface` at left 10.5% / top 6.5% / 77.14% x 87%, `BOARD_INSETS` and `POST_SIZES` in `packages/fridge-ui/src/features/fridge/state/board.ts`, slot placement in `packages/fridge-ui/src/styles.css`, backdrop as 3:2 cover with CSS mask.
- Asset flow: web shell builds `webFridgeAssets` (`apps/web/src/features/fridge/assets.ts`) into the `FridgeAssets` type (`packages/fridge-ui/src/types.ts`); `FridgeApp` renders backdrop, surface, plant, then HTML posts. Shells own asset URLs per the platform boundary (`docs/architecture/frontend.md`).
- Data: `boards` has one row per home (`board_kind` enum `fridge`, unique on home+kind); `posts` are already board-scoped with normalized 0..1 positions; `media_assets` is home-scoped with private storage keys; the board response carries `postAdditions` plus `serverTime` (`packages/contracts/src/index.ts`, `packages/database/src/schema.ts`).
- Plant growth touches ~24 files (state, components, API, DB counter, browser specs) and is the only consumer of `postAdditions`.
- An unconnected second style exists: moonlit bedroom plus square-canvas nightstand (`apps/web/public/artwork/bedroom/README.md`).
- No production database exists (deployment is Phase 7, not started), so migrations may reshape tables freely; local developers re-migrate.
- User decisions already locked: image source is upload or AI-generated; theme scope is the home; theme changes are creator-only; provider is OpenAI behind a swappable seam; growth decor goes away; note visuals may adapt per theme but noting behavior stays.

## Constraints And Non-goals

- The noting model is untouched: create, move, edit, modal, one-hour grey removal with shared Undo, last-save-wins, polling, membership checks.
- This plan ships one board per home; the schema just becomes ready for many (bed board plus nightstand board in one scene comes later).
- No per-theme CSS or free-form style payloads; no third-party agent/LLM framework; no production deploy work.
- Assumed from the user's "1 yes": the rename covers fridge-named files, symbols, and docs, not the "home" concept itself.

## Key Decisions

| # | Decision | Choice | Why / rejected alternative |
|---|---|---|---|
| 1 | Slot contract | Keep stage geometry fixed; art must fit it, never redefine it | This is the user's cardboard-dress rule and makes "CSS is not an issue" true by construction. Rejected: per-theme geometry, which reintroduces layout risk for every new style. |
| 2 | Manifest v1 | JSON holds generation constraints plus display hints: required canvases (backdrop 3:2, surface 7:10 with alpha), safe-zone confirmation, suggested paper/ink palettes, style tags from an allowlist; placement numbers default to today's values and are server-clamped | AI can propose all of these; the server validates all of these. Rejected: raw CSS or executable content in the manifest. |
| 3 | Multi-board readiness | Add `boards.slot` (default `main`) and `boards.theme_id`; uniqueness becomes (home, slot); app enforces one board until a later phase | Posts are already board-scoped, so future boards need no post migration. Rejected: building multi-board rendering now, which doubles UI scope. |
| 4 | Decor removal | Delete plant components, growth state, `postAdditions` counter, and related specs/counters | User decision; the counter has no other consumer. Rejected: keeping the column "just in case". |
| 5 | Rename scope | Rename package internals (`features/fridge` to `features/board`, `FridgeApp` to `BoardApp`, `FridgeAssets` to `ThemeAssets`, backdrop/surface slots), docs, and asset paths; reshape `board_kind` in the same pre-production migration window | One mechanical unit beats slow drift. Package name follows the same rule unless the rename unit finds a hard blocker. |
| 6 | Theme storage | New `themes` table (home-owned, creator-managed): manifest JSONB, origin (`bundled`/`upload`/`generated`), private storage keys for art; bundled themes stay public repo assets with checked-in manifests | Keeps member-only art under the existing storage/membership rules without overloading the post-media lifecycle. |
| 7 | AI seam | Small in-repo port interface (`generateArt`, `proposeManifest`) with an OpenAI implementation plus a stub selected by env (no key = stub) | Two narrow operations do not justify a framework; matches the repo rule of explicit modules over generic wrappers. The official `openai` Node SDK speaks to the Image API and Structured Outputs. |
| 8 | Generation timing | Synchronous request/response for v1 with a documented timeout; async jobs only if measured latency demands it | One theme set per call is bounded; no queue/worker exists yet and this plan does not introduce one. |
| 9 | Propagation | Active theme rides the existing board response; the 5s poll plus focus refetch distributes it | No new realtime channel; same staleness behavior members already have. |
| 10 | Note colors | Posts keep their stored colors across theme switches; the theme only changes composer defaults and suggestions | Zero post migration; "same notes, new room". Rejected: rewriting post colors on theme apply. |

## Recommended Approach

Treat the theme manifest as a contract in both directions. Going out, it constrains generation: the prompt builder injects slot rules (empty surface, no text/logos, exact canvases, transparent surface) so output fits the fixed CSS. Coming back, the server validates AI or upload input against the same zod schema (already the repo's contract tool), clamps numbers, checks palette contrast, confirms minimum usable surface, and falls back to the default theme on any failure. Theme art for uploads and generations lives in private member-only storage; reads re-check home membership exactly like post media. The frontend keeps one injectable board component: playground uses the bundled default, shared homes use the board response's theme. The bedroom nightstand is refit onto the standard 7:10 surface canvas to prove the contract with a second bundled theme before any AI work begins.

Manifest v1 sketch (zod in `contracts`, shared by API and AI parsing):

```json
{
  "version": 1,
  "slots": { "backdrop": "3:2", "surface": "7:10-alpha" },
  "surfaceConfirmed": true,
  "paper": ["#f5dfa0", "#efcac3", "#dcd5ed"],
  "ink": ["#33352e", "#344e40"],
  "styleTags": ["gouache", "warm"]
}
```

## Work Plan

- **Unit A - Rename, decor removal, slot doc.** Rename shared board files/symbols/docs/asset paths per decision 5; delete plant growth, `postAdditions`, and their tests; write the slot contract doc superseding the fridge-illustration geometry sections. Depends on nothing. Touches `packages/fridge-ui`, `apps/web` fridge shell, `packages/contracts`, `packages/api-client`, `packages/server` post queries, `packages/database` (counter removal), browser specs.
- **Unit B - Manifest plus persisted per-home theme (no AI).** Add the zod manifest schema, `themes` table, board `slot`/`theme_id` migration; refit bedroom art to the 7:10 surface canvas as the second bundled theme; add creator-only select/apply endpoints plus UI; theme rides the board response and poll. Depends on A.
- **Unit C - Upload path.** Creator uploads backdrop/surface art; server validates type/size/dimensions, stores privately, and runs vision analysis through the port interface to propose the manifest (surface confirmation, palette extraction) via Structured Outputs; preview before apply. Depends on A and B.
- **Unit D - Prompt-to-theme generation.** Implement the OpenAI adapter (Image API generations with transparent surface output, Structured Outputs manifest parsing), stub provider, env contract (`OPENAI_API_KEY` server-only, model ids pinned at build time and rechecked per repo convention), rate/cost guards, creator-only UI with preview. Depends on B and C.
- **Unit E - Docs and roadmap.** Update `PLAN.md` vision/phases, `docs/architecture/frontend.md` ownership map, icon/artwork guides split (interface icons unchanged; scene art moves under the theme doc), and `.env.example`. Depends on B for accuracy; lands with each unit's behavior.

## Validation Plan

- Every unit: `pnpm check` (format, lint, types, tests, production build) from the repo root.
- Unit A: focused vitest for board state/controller specs; confirm zero references to plant growth and `postAdditions`; full browser suite passes with plant assertions removed; visual desktop plus emulated-touch review of the unchanged default scene.
- Unit B: contract and api-client tests for theme schemas/endpoints; DB integration tests for theme CRUD, creator-only enforcement, member read, cross-home isolation; new browser specs for creator theme switch and member-visible change on poll; posts keep positions and colors across switches.
- Unit C: invalid/oversized upload rejection, non-member art access rejection, manifest clamp behavior (out-of-range values fall back, never break layout), preview-then-apply flow in browser tests.
- Unit D: adapter tests against recorded fixtures plus a live opt-in check with a real key (not in CI); timeout and failure paths show errors without applying partial themes; generation works with stub (bundled/upload unaffected).
- Highest-risk check: Unit D's live generation fidelity (transparent surface actually fits the slot, empty usable surface) needs human visual review, not just assertions.
- Carry-over: the pending live two-account review and physical-phone review from Phases 4/5 still gate any device/trust claims.

## Risks / Rollback

- AI latency, cost, and quality variance: bounded by creator-only access, explicit apply step, and the stub default; org verification may be required before GPT Image models work.
- Transparency and empty-surface fidelity: prompt constraints plus manifest confirmation plus human preview; fallback to the default theme on any failure.
- Uploaded content moderation stays an open question; member-only visibility limits blast radius but is not moderation.
- Local databases re-migrate (acceptable pre-production); each unit is revertible via git plus local re-migration since no prod data exists.

## Open Questions

- Confirm the rename assumption in Constraints if "1 yes" meant anything beyond the fridge-file rename.
- User-facing word for the feature: assumed "theme".
- Theme upload limits: assumed reuse of the 10 MiB media cap.
- None of these block Unit A.

## Sources

- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/guides/structured-outputs
