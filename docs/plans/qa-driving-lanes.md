# QA driving lanes for Noted (web, Capacitor Android/iOS, Electron)

Status: Planned 2026-10-03 — execute after the Electron and Capacitor
shells land (owner's trigger). Phase 0 has no dependency and can be
pulled forward alone.

Reference implementation: the TabLogs mobile `qa/` system (TabLogs repo,
`qa/` on its automation branch) plus its `mobile-drive` / `mobile-qa-job`
skills and `qa-explorer` agent. This plan ports the pattern, not the
code: TabLogs' harness is Ionic/Angular-specific (emulator scripts bound
to its package id and routes, 29-type production-API fixtures,
multi-clone workspace guards, Shortcut workflow). What transfers is the
lane design: persistent signed-in lanes with their own debug ports, a
doctor that prints verdicts, a runbook of repairs, exploration scripts
sharing helpers with the saved Playwright suite, `test-id` hooks, and
the brief → parallel explorers → verify-against-code → resume-to-retest
loop.

## Goal

One `qa/` home in Noted from which an agent can hand-drive any shell
(Chrome lane for `apps/web` now; Capacitor Android/iOS and Electron
lanes when those shells exist), run saved Playwright specs in place on
the lanes, and run multi-area QA jobs as parallel briefs — reusing the
TabLogs loop that found every high/medium defect there.

## Success criteria

- `node qa/lanes/up.js` brings up every configured lane and the doctor
  reports `ok` per lane; a broken lane maps to a RUNBOOK row, never to
  guesswork.
- An exploration script runs on any lane kind through one runner with
  shared page helpers (no agent writes its own lane connection).
- The saved suite replays in place on the running lanes and reports one
  results table per run.
- A trial QA job works end to end: brief per area, one explorer
  subagent per lane, findings verified against the code, fix re-tested
  by resuming the finder, verified findings appended to FINDINGS.md.
- `pnpm check` stays green; `qa/` lane state, profiles, and results
  are gitignored and never ship.
- The `architect` skill records the new `qa/` pattern (it requires a
  skill update with any new pattern).

## Approach

Playwright everywhere, one lane abstraction, phases gated on shells.
Chrome attaches over the lane's DevTools port (persistent profile keeps
the login, as in TabLogs `lanes/chrome.ps1`: `--remote-debugging-port`,
`--user-data-dir`, `--headless=new`, readiness via `/json/version`).
Android attaches through Playwright's experimental Android API, which
covers Chrome for Android and Android WebView via `android.devices()`
and `device.webView({ pkg })`. Electron launches through Playwright's
experimental Electron API (`electron.launch`, `firstWindow`). iOS goes
through Appium's XCUITest driver, which requires a macOS host with
Xcode — so iOS is a conditional phase, since this dev machine is
Windows. A raw-CDP escape hatch (TabLogs `driver/cdp.js` style) is
built only if an experimental API proves insufficient.

## Key decisions

- D1 — Port the pattern, not the files. Lane persistence, doctor
  verdicts, runbook repairs, shared drive/test helpers, `test-id`
  hooks, and the brief loop transfer. Ionic selectors, the TabLogs
  package id, AVD/repoint specifics, 29-type fixtures, multi-clone
  guards, usage-eval, and the Shortcut skill stay behind.
- D2 — Home is top-level `qa/`, a private dev-only workspace package
  `@noted/qa`, with a turbo task for the saved suite. Lane config,
  profiles, and results are gitignored. Single workspace: no
  multi-clone guards (non-goal until a second clone exists).
- D3 — One driver model per shell, all Playwright: Chrome over the
  lane DevTools port; Android via `_android` WebView attach;
  Electron via `_electron.launch`. Both mobile/desktop APIs are
  experimental, so pin the Playwright version and record the raw-CDP
  fallback as the documented escape hatch.
- D4 — Lane config is `qa/lanes.local.json` (gitignored) copied from
  a tracked `lanes.local.json.example`: chrome entries carry
  port/profile; android entries carry avd/pkg; electron entries carry
  the main entry plus user-data-dir; ios entries carry simulator udid
  plus the Appium server URL.
- D5 — Sign-in is a persistent lane profile, logged in once by hand
  (TabLogs rulebook: never type passwords, never copy sessions
  between lanes). Non-interactive CI sign-in goes through the
  Firebase Local Emulator Suite's Authentication emulator, evaluated
  at implementation time; local-first until then.
- D6 — Fixtures seed through the local stack (Postgres plus the API,
  following the existing `db:seed` pattern), one home per lane, `qa`
  naming, delete-by-id. No production-data machinery: Noted QAs
  against local data.
- D7 — Hooks use Playwright's default `data-testid` (zero config,
  React convention), not TabLogs' custom `test-id` attribute. Added
  only on controls a test or fix touches; tests select by hook, never
  by label. The hook table lives in `qa/README.md`.
- D8 — Skills live in `.agents/skills/noted-drive` and
  `.agents/skills/noted-qa-job` (Noted's skills convention), with an
  explorer brief template. Explorer agents are Muse subagents, one
  per lane; retest resumes the finder through the runtime's followup
  mechanism.
- D9 — iOS stays conditional on a macOS host with Xcode (Appium
  XCUITest requirement). No iOS lane work on Windows beyond keeping
  the lane abstraction kind-shaped for it.

## Steps

### Phase 0 — Web lane, drive runner, hooks (no gate; pull-forwardable)

1. Scaffold `qa/`: `lanes.local.json(.example)`,
   `lanes/chrome.ps1` (start/stop/login modes per the TabLogs
   original), `lanes/up.js`, `lanes/doctor.js` with four checks
   (lane answers, signed in — route is not the login page and an
   authed call succeeds, bundle is live not stale, list latency
   under budget), `ws.js` to print the config.
2. `qa/pw`: Playwright config attaching to the running lane's
   DevTools port in place; `fixtures.ts` (one worker per lane,
   console-error capture, screenshot plus trace on failure);
   `helpers.js` (Noted routes: home, board, TV, book; visible-copy
   locators; `rowTexts`); `drive.js` exploration runner (`--lane`,
   `-e`, shared helpers — agents never open their own connection);
   `preflight.ts` (dev server up, lane free); markdown reporter with
   one results folder per run and no automatic retry.
3. Adopt `data-testid` (D7); hook the controls the smoke specs
   touch; record them in `qa/README.md`.
4. Fixtures `data.js`: create home/notes/reels through the local
   API, `rows`, `wipe` (refuses non-`qa` names); document the per-lane
   baseline in `qa/README.md`.
5. Skills plus `AGENT.md` rules adapted for local data (drop the
   production-data rules; keep: lane-only, no `src/` edits while
   agents run, no saved spec unless the brief asks, hand back
   findings/passed/left-behind tables).
6. Smoke: 2–3 specs (home opens signed in, create-plus-delete note,
   one realtime invalidation check) and one drive-script trial.
7. Update the `architect` skill with the `qa/` pattern (D2).

### Phase 1 — Android lane (gate: Capacitor Android shell runs on an emulator with live reload)

1. `lanes/emulator.ps1`: writable AVD with its own login, snapshot
   discipline, graceful stop only; repoint equivalent for Noted's
   `server.url` when the dev-server address moves; serial tracking
   (serials assign at boot, config records the usual pairing).
2. Playwright `_android` attach via `device.webView({ pkg })`;
   restart/attach survival first. If the experimental API blocks,
   fall back to raw CDP over an adb-forwarded DevTools socket and
   record that as the lane's driver (D3 escape hatch).
3. Doctor emulator checks (answers, signed in, bundle origin equals
   the expected live-reload host, latency budgets) and RUNBOOK rows:
   recycle-on-slowness numbers measured on this box, repoint,
   snapshot-resume stale handles, and whether a WebView reload logs
   Noted out (TabLogs forbids it — verify, do not assume).
4. `@native` specs only for surface that needs the device (offline,
   SQLite, camera, GPS, files); everything else stays on Chrome.
5. Trial QA job on one changed area, one chrome plus one emulator
   lane.

### Phase 2 — Electron lane (gate: unpackaged Electron shell runs)

1. `_electron.launch` fixture (main entry from config, isolated
   user-data-dir per lane; persistent-profile mode for signed-in
   lanes); first-window handle as the driven page.
2. Reuse Phase 0 helpers/drive/reporters under an `electron`
   project; add main-process log capture and native-dialog stubs
   only as specs demand.
3. Trial QA job on one area; RUNBOOK rows for Electron-specific
   repairs (stale user-data-dir, two instances on one profile).

### Phase 3 — iOS lane, conditional (gate: Capacitor iOS shell plus a macOS host with Xcode)

1. Appium with the XCUITest driver on the Mac; simulator lane
   defined in `lanes.local.json` with the Appium server URL;
   WebView-context driving for app content.
2. Thinnest viable slice first: lane up, one drive script, two
   specs. Full parity only if iOS-specific surface justifies it.
3. Document the manual fallback: Safari Develop menu attach to the
   WebView for inspection without automation.

### Cross-cutting (all phases)

- Grow `qa/README.md`, `RUNBOOK.md`, `FINDINGS.md`, and
  `HAZARDS.md` on demand, one fact one file; add `qa/lint.js`
  doc-budget enforcement only if the docs sprawl.
- Non-goals: multi-clone workspaces, per-agent cost eval, perf
  harness, per-screen map docs, Shortcut workflow.

## Validation plan

- P0: `node qa/lanes/up.js` then `node qa/lanes/doctor.js` report
  `ok`; `node qa/pw/drive.js --lane chrome-1 -e "<open home, return
  counts>"` returns live data; `npx playwright test` from `qa/pw`
  is green; `pnpm check` is green; one trial brief runs on one lane
  and its finding verifies against `git show`.
- P1 (highest risk — experimental WebView attach plus TabLogs'
  WebView quirks may recur): attach, force-stop plus relaunch,
  re-attach with the session surviving; reload-logout probe decides
  the RUNBOOK row; `@native` specs pass twice in a row (`--repeat-
  each 2`, a split is a finding); trial two-lane job completes.
- P2: launch, window handle, persistent session across relaunch;
  specs green on the `electron` project; trial job completes.
- P3: Appium session on the simulator, WebView context listed, one
  drive script returns live data; manual Safari-attach fallback
  verified once by a person.

## Risks / open questions

- Playwright's Android and Electron APIs are experimental and may
  churn: pin the version; the D3 raw-CDP fallback bounds the risk.
- The WebView reload-logout and snapshot-resume quirks are TabLogs
  observations on its stack, not laws: Phase 1 re-verifies each
  against Noted's Capacitor shell before writing RUNBOOK rows.
- Emulator RAM on this box: run one AVD at a time until measured
  otherwise (TabLogs thrashed under two AVDs plus lanes).
- Google sign-in cannot be scripted: persistent profiles locally;
  the Firebase Auth emulator path for CI is unevaluated.
- Open: is a macOS host with Xcode available for Phase 3? The
  phase stays conditional until yes.
- Open: is unattended CI replay in scope, or local agent-driven QA
  only? Plan assumes local-first, CI later.

## Sources

- https://playwright.dev/docs/api/class-electron
- https://playwright.dev/docs/api/class-android
- https://playwright.dev/docs/locators
- https://capacitorjs.com/docs/v5/vscode/debugging
- https://appium.github.io/appium-xcuitest-driver/5.16/
- https://appium.github.io/appium-xcuitest-driver/5.16/installation/requirements/
- https://firebase.google.com/docs/emulator-suite
