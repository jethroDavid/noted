# Noted: product and implementation plan

Updated: 2026-09-18

Status: active implementation. Phases 0-3 are complete; the Phase 2 prototype still needs physical-device review. Phase 3 established the shared frontend boundary before authentication or persistence work begins. This document records the agreed vision and implementation defaults. Build one phase at a time and review the working result before extending it.

## Start here: phase-by-phase roadmap

**Current progress:** Phases 0-3 are complete. The fridge now runs from a shared React package through the Next.js shell, with desktop and emulated-touch checks. **Next: Phase 4 introduces identity, homes, invitations, and the first real shared API client.** Physical-phone review from Phase 2 remains open.

Each phase has its own task checklist and completion criteria in [the detailed phase plans](#11-phased-delivery). Complete and review one working milestone before moving to the next. Check off tasks only after implementation and verification.

| Phase | What we build | Working result | Status |
| --- | --- | --- | --- |
| 0 | Product and architecture plan | This document | Documented |
| 1 | Monorepo and local foundation | Next.js, local PostgreSQL, Drizzle, migrations, and checks run together | Complete |
| 2 | 3D fridge and touch interaction | Move fixture posts and edit through modals on desktop and phone layouts | Implemented; physical-phone review pending |
| 3 | Shared frontend foundation | Next.js renders the fridge from a reusable React package | Complete |
| 4 | Identity, homes, and invitations | Invited users automatically see their homes through the first shared API client | Not started |
| 5 | Persistent shared text notes | Two users share notes, positions, polling, and one-hour removal with Undo | Not started |
| 6 | Images and voice notes | Complete local alpha-alpha prototype | Not started |
| 7 | First deployment | Hosted web app using Neon, real Google sign-in, and private media storage | Not started |
| 8A | WebSockets | Members see saved changes without waiting for a poll | Later |
| 8B | Redis coordination | Changes reach members connected to different realtime instances | Later |
| 8C | Caching | A measured improvement with correct invalidation and access checks | Later |
| 8D | Queue and worker | Reliable background cleanup with retries | Later |
| 9 | Electron desktop | Installable desktop app using the shared React frontend and backend | Later |
| 10 | Capacitor mobile | Device-tested mobile app using the shared React frontend and backend | Later |
| 11 | Real-world map, then additional rooms | Public home discovery with private fridge access | Later |
| 12 | Family activities | One chosen chat, game, or activity experience at a time | Optional |

**First finish line: Phase 6.** Phases 1-6 deliver the simple, usable local product. Phase 3 is an intentional architecture milestone rather than a new product feature. Backend learning and other platforms follow the alpha-alpha milestone. Phase 7 is the deployment checkpoint; its timing can move if we want to continue learning locally before paying for hosting.

## 1. Product vision

A shared home with a refrigerator covered in notes, photographs, and voice messages. Members leave small everyday messages, move things around, and enjoy a space that feels personal and playful.

The first app is a browser experience built with Next.js. It is also a portfolio and learning project: establish a reusable React frontend and a simple working foundation, improve the backend through concrete features, then add Electron desktop and Capacitor mobile applications around that same frontend. Shared rooms, a real-world neighborhood map, chat, and family activities are longer-term possibilities.

The refrigerator is visible directly after entering a home. There is no door-opening interaction. Start in 3D, viewed mostly from the front with a little depth. Keep the composition warm, readable, and casual rather than visually busy.

Noted is the repository name. The public product name is undecided.

## 2. Decisions agreed with the user

| Area | Decision |
| --- | --- |
| Repository | Monorepo; web first, with the React frontend shared from the beginning for Electron and Capacitor |
| Web | Next.js with TypeScript |
| Data | PostgreSQL, Drizzle ORM, Neon when deployed |
| Development | Local database and local media; Firebase Authentication is online once identity work begins |
| Identity | Google sign-in; Firebase Authentication is the planned implementation |
| Homes | One fridge initially; people may belong to multiple homes |
| Invitations | Creator invites by Google account email; no acceptance step or invitation email |
| Returning users | Invited homes appear automatically |
| New users | Their invited homes appear after first signing in with the matching email |
| Home management | Creator can rename the home, invite, and remove members |
| Leaving | Members can leave; creator departure and ownership transfer have no UI or operation initially |
| Membership | Home membership is required to read or change fridge contents |
| Editing | All members may edit, move, and remove all posts |
| Conflicts | Last successful save wins |
| Post types | Text OR one image OR one voice recording; no combined posts |
| Voice | Record in the app, stop, preview, post; maximum one minute |
| Photos | One image per post; no captions initially |
| Appearance | Text and background colors; a casual, readable font; magnets and photo styling |
| Attribution | No author or timestamp display on posts initially |
| Surface | Fixed fridge surface; posts can overlap |
| Position | Shared between members; moving only, no resizing or rotation controls |
| Layers | New posts appear above older posts |
| Selection | Clicking/tapping brings a post forward locally to interact with it; no shared arrangement change |
| Editing UI | A modal outside the 3D scene |
| Touch | Required from the beginning |
| Removal | Greyed-out shared state for one hour; any member can undo before expiry |
| Updates | Polling first; WebSockets later |
| Future map | Real-world map; public home name and pin by default; private fridge contents |
| Map position | One shared position per home; placement near the creator's reported device location |

Earlier suggestions for secret words, invitation codes, acceptance buttons, five-second deletion, first-save-wins conflict handling, and a 2D-first fridge are superseded.

## 3. Proposed implementation defaults

These are adjustable starting choices, not additional requirements from the user.

- Use pnpm workspaces, one lockfile, and a pinned package-manager version. Use workspace scripts initially; introduce a task orchestrator only when it solves an actual coordination problem.
- Use the Next.js App Router and Node.js server runtime for database, authentication verification, and local file access.
- Use Three.js through React Three Fiber for the shared web-based fridge. Verify it in Next.js, Electron's renderer, and Capacitor's WebView when those shells are added; do not select preview releases by default.
- Use a real Firebase project for Google sign-in during local development when identity work begins in Phase 4.
- Use local PostgreSQL through Docker Compose and a persistent volume. Check Docker availability before setup; a native local PostgreSQL installation is an acceptable fallback.
- Use one process-level `pg` connection pool with Drizzle's node-postgres adapter. No Redis or local PgBouncer service initially.
- Store uploads in a private local directory in development, behind an application storage interface. Select deployed object storage during deployment planning.
- Poll the currently open fridge every five seconds while the page is visible. Refresh on focus, after mutations, and after reconnecting; back off on errors.
- Use the agreed **one-hour** removal recovery period, defined centrally.
- During pending removal, disable editing and dragging. Permit Undo by any current member.
- Keep images/audio available to members during the recovery period; revoke application access when that period expires.
- Use browser-independent normalized coordinates for post centers and clamp full post bounds to the fridge surface.
- Proposed initial limits: 2,000 characters per text note, 10 MiB per image, 10 MiB per audio upload, and 60 seconds per voice recording. Verify formats and durations during the media phase.
- Choose a small readable color palette first. Do not build a typography or theme editor.

## 4. Local development and deployment boundaries

| Component | Local development | Deployment |
| --- | --- | --- |
| Web/API | Local Next.js process | Provider selected later |
| Database | Local PostgreSQL | Neon PostgreSQL |
| Queries and schema | Drizzle + node-postgres | Same schema and query implementation |
| Connections | Small application pool | Small application pool using Neon pooled endpoint |
| Authentication | Online Firebase Auth with real Google sign-in | Online Firebase Auth with production configuration |
| Images/audio | Private local filesystem | Private object storage selected later |
| Email delivery | None | None for the initial product |
| Redis, worker, WebSockets | Absent | Added in later learning phases |

Local PostgreSQL is fully compatible with this approach. It does not need to emulate Neon's infrastructure. Keep to ordinary PostgreSQL features, align supported database versions, and apply the same checked-in migrations to each environment. Test migrations and application behavior against Neon before declaring a deployment ready.

Phases 1-3 do not require a Firebase project. Starting in Phase 4, local development uses the real online Firebase Authentication service and real Google accounts. Keep PostgreSQL and media local until deployment. Bundle fonts and 3D assets locally. The future map may use online map tiles; offline tile support is not part of the alpha.

Phone testing needs a reachable development origin. Camera/microphone and authentication behavior must be tested over a suitable secure origin; ordinary HTTP at a computer's LAN address is not equivalent to localhost on that phone. Plan a local HTTPS certificate and device trust setup when testing on physical phones.

### Environment configuration contract

- Keep database URLs, privileged Firebase Admin credentials, and filesystem paths server-only. Firebase's browser configuration is public configuration, but environment-specific values still belong in environment files.
- Separate database application and migration connection settings; on Neon use its pooled application endpoint and an appropriate direct migration endpoint.
- Explicitly select the Firebase project and local/deployed storage mode through environment configuration.
- Commit an example environment file with placeholders and a local setup guide; ignore real environment files, recordings, and images.
- Use separate persistent directories/volumes for development and test data. No destructive reset in ordinary startup.
- Fix or document development ports so the app and phone access agree. Verify port availability during setup rather than silently pointing to another running project.

## 5. Monorepo shape

Target structure; future applications and packages are created when their phase begins, not installed as empty scaffolds today.

```text
noted/
  PLAN.md
  README.md                         # local setup and common workflows
  package.json                      # workspace entry points
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .env.example
  .gitignore
  compose.yaml                      # local PostgreSQL initially
  apps/
    web/                            # Next.js shell, HTTP routes, and backend runtime
    desktop/                        # future Electron shell and preload boundary
    mobile/                         # future Capacitor shell and native projects
    realtime/                       # future persistent WebSocket service
    worker/                         # future background job runner
  packages/
    fridge-ui/                      # shared React UI, 3D scene, interactions, and styles
    contracts/                      # request/response schemas and public types
    domain/                         # pure rules and shared constants
    api-client/                     # typed HTTP calls, introduced with the first real API
    database/                       # server-only Drizzle schema, migrations, pg pool
    server/                         # use cases, membership checks, auth/storage adapters
    config/                         # shared TypeScript/lint configuration
    design-tokens/                  # future shared colors, spacing, typography values
  docs/
    decisions/                      # brief records when substantial decisions change
  .local/                           # ignored local uploads
```

Create a package when it contains real responsibilities. The completed fridge prototype makes the frontend boundary concrete, so Phase 3 extracts it into `packages/fridge-ui` before more features are added. The package contains the existing React UI, 3D scene, interaction code, tests, and scoped styles. `apps/web` remains the Next.js route and platform shell that renders that package.

Phase 3 does not invent backend traffic merely to populate `api-client`. Phase 4 introduces `contracts`, `api-client`, and server operations together around the first real identity/home HTTP endpoints. From that point forward, the web frontend uses the same API client that Electron and Capacitor will use later.

### Dependency rules

- The Next.js web shell, Electron renderer, and Capacitor application render `fridge-ui`; they do not maintain copies of the fridge interface.
- `fridge-ui` is a React DOM package. It may use browser standards and React Three Fiber, but it must not import Next.js, Electron, Capacitor, database, or privileged server modules.
- Platform shells provide asset locations and, when needed, small capability adapters for operations such as choosing a photo or recording audio.
- Browser, desktop renderer, and mobile code may use `fridge-ui`, `contracts`, `domain`, and `api-client`.
- They must never import `database`, privileged authentication code, filesystem storage, or server secrets.
- `domain` contains pure rules with no Next.js, DOM, database, or Firebase dependency.
- `contracts` describes API payloads rather than exposing database rows as the public contract.
- Next.js routes call application services in `server`; those services call `database` and storage/auth adapters.
- Server Components can call the same services directly. Do not make them call the app's own HTTP routes unnecessarily.
- Use HTTP endpoints for shared client operations so Capacitor and Electron are not coupled to Next.js Server Actions.
- `api-client` is client-side request code, not another backend. It sends authenticated HTTP requests to the backend hosted by `apps/web` and never receives database credentials.
- Capacitor compiles the shared React frontend into its web bundle. The mobile shell owns Capacitor configuration, iOS/Android projects, permissions, and plugin adapters.
- Electron packages a renderer that imports the shared React frontend. The desktop shell owns its main process, preload boundary, window lifecycle, authentication callbacks, updates, and packaging.
- Next.js remains the single HTTP backend initially. Later realtime and worker applications may become separate processes only when their phases require them.

## 6. Data model

Use UUID identifiers, server-managed timestamps, foreign keys, and explicit constraints. Exact column names may change during implementation.

| Entity | Main fields and purpose |
| --- | --- |
| `users` | id, unique auth subject, verified normalized email, optional account display name, created time |
| `homes` | id, name, creator user id, created/updated times |
| `home_memberships` | home id, user id, joined time; unique home/user pair |
| `home_invitations` | home id, normalized target email, inviter id, created time, consumed/revoked state |
| `boards` | id, home id, kind = fridge, created time; one created per home initially |
| `posts` | id, board id, kind, text or media id, foreground/background colors, normalized x/y, created/updated times, deletion request/deadline, internal creator id |
| `media_assets` | id, home id, storage key, validated content type, byte size, dimensions or duration, lifecycle state, created time |

No room table is needed now. A board belongs to a home; a future room table and optional board-to-room relationship can be added by migration. This preserves the home/board distinction without implementing unused room behavior.

Enforce exactly one content type: text posts have text and no media; photo and voice posts reference the corresponding validated media type and have no text caption. Keep internal authorship metadata for ownership tracing even though it is not displayed on posts.

Index memberships by user and home, invitations by normalized email, posts by board and creation order, and pending removals by their deadlines. Add indexes in response to actual query shapes, not speculatively.

### Invitations and identity

1. Verify the authenticated identity on the server and obtain its verified email.
2. Upsert the local application user by stable auth subject.
3. In a transaction, consume active matching email invitations and create memberships without duplicates.
4. Return the user's home list. No acceptance screen or email sending occurs.
5. Inviting an existing user immediately creates their membership; inviting a new email creates a pending invitation.
6. Only the creator can invite, revoke a pending invitation, rename the home, or remove a member.
7. Removing or leaving a home must not leave a reusable invitation that silently restores membership on the next login. A new explicit invitation can regrant access.
8. The creator remains a member. Reject attempts to remove the creator or leave as creator, and provide no corresponding UI. Home deletion and ownership transfer are deferred.

Normalize email consistently without guessing Google aliases or stripping dots/plus suffixes. Test the verified-email requirement through the server verification boundary and with real Firebase test accounts. Do not trust an email supplied in a request body as the caller's identity.

## 7. Runtime flow and API

The initial backend runs inside Next.js. Keep business operations separate from route handlers so a future worker or service can reuse them.

```text
Browser interaction
  -> typed API client with current authentication token
  -> Next.js route handler in Node.js
  -> verify identity and current home membership
  -> validate operation and execute application service
  -> Drizzle -> pg pool -> local PostgreSQL / Neon
  -> return a minimal response -> update the scene
```

Proposed endpoint families under `/api/v1`:

| Operation | Endpoint |
| --- | --- |
| Synchronize identity and invitations | `POST /session` |
| List/create homes | `GET /homes`, `POST /homes` |
| Rename home | `PATCH /homes/:homeId` |
| Invite/revoke invitation | `POST /homes/:homeId/invitations`, `DELETE /homes/:homeId/invitations/:invitationId` |
| List/remove members | `GET /homes/:homeId/members`, `DELETE /homes/:homeId/members/:userId` |
| Leave as noncreator | `POST /homes/:homeId/leave` |
| Read fridge state | `GET /homes/:homeId/boards/:boardId` |
| Create/edit post | `POST /homes/:homeId/boards/:boardId/posts`, `PATCH /homes/:homeId/posts/:postId` |
| Save movement | `PATCH /homes/:homeId/posts/:postId/position` |
| Request removal/undo | `POST /homes/:homeId/posts/:postId/removal`, `DELETE /homes/:homeId/posts/:postId/removal` |
| Upload/read media | `POST /homes/:homeId/media`, `GET /homes/:homeId/media/:mediaId` |

Every resource lookup checks the actual home relationship. A home id in the URL is not authorization. Do not make member-only media public through a static directory. Basic membership checks are part of the product behavior, not a later scaling feature.

Return clear authentication, forbidden, missing, validation, and upload errors. Media and fridge responses must not enter a public shared cache. Add membership checks to all future cache, realtime subscription, and background-operation entry points as well.

### Last-save-wins behavior

- Last save means the last update successfully applied by the database; client device clocks do not decide winners.
- Content saves replace the editable content fields, and position saves replace only coordinates. A drag must not accidentally overwrite text from a stale full-row payload.
- No optimistic-lock rejection for normal simultaneous edits: this matches the user's selected behavior.
- Deletion state is a separate rule. Editing a pending or expired post must not resurrect it.
- Polling must not overwrite an open modal draft or an active drag. Apply the latest authoritative state after completion and preserve unsaved text if a request fails.
- Cancel/ignore obsolete fetches on home changes and prevent late responses from repainting another home's scene.

## 8. Fridge interaction and appearance

### Scene

- A real 3D fridge model, initially built with simple geometry; slightly angled front view and restrained lighting.
- Fixed front surface with no door animation, free camera rotation, room exploration, or physics simulation.
- Notes, photo prints, and voice cards sit on that surface with small depth offsets and magnet details.
- New posts receive the newest shared creation order. Stable id ordering resolves equal timestamps.
- Selection raises a post only in the current client's render state. It never updates shared position or ordering.
- On deselection, restore its normal creation-based layer. Greyed-out posts keep their place until expiry or Undo.

### Editing and touch

- A visible Add action offers Text, Photo, or Voice.
- Selecting a post opens a readable HTML modal with the relevant edit, playback, removal, and Undo controls.
- Dragging moves the post on the fridge plane. Use pointer capture and a movement threshold to distinguish a tap from a drag.
- Persist a completed move, not every pointer movement. Roll back the visual move if the server rejects it.
- Fit the fridge into the viewport while preserving its coordinate system. Keep touch targets large enough to select overlapping posts.
- Keep page/modal scrolling usable; restrict gesture suppression to the interaction surface.
- Support keyboard selection, modal focus management, Escape, and a basic keyboard movement alternative. These controls operate the same post model.
- If 3D rendering cannot initialize, show a useful recovery state and a minimal accessible way to reach posts; the primary experience remains 3D.

Visual review should use actual text/photo/voice examples on laptop and phone sizes before polishing materials. Do not delay readability and touch testing until the end.

## 9. The slow-removal mechanic

Removal intentionally takes time. It is a shared action other members can reverse.

1. A member requests removal. The server records `deletionRequestedAt` and `deleteAfter = now + 1 hour`.
2. The note turns grey, stays in place, and shows an understandable pending-removal state with Undo.
3. Any current member can undo before the deadline; the server clears the timestamps.
4. Repeated removal requests do not restart or shorten the deadline.
5. At the deadline, the server treats the post as expired. Reads omit it, Undo fails, and media access through that post is no longer permitted.
6. Client timers improve display timing, but database time and persisted deadlines determine eligibility across refreshes and restarts.

Use atomic conditional updates for Undo/removal races. Return server time with board data so a client's clock does not control the mechanic.

**No queue is required for this behavior initially.** Database queries can exclude expired posts even if no process ran at the exact deadline. A maintenance command can physically remove expired rows and unreferenced media, with an isolated test mode and explicit retention rules. Logical expiry and physical cleanup are different responsibilities. A later worker can automate cleanup without changing what members see.

Tests should advance a controllable clock; they should not wait an hour. Test one Undo before the deadline and one rejection at/after it, including a restart and simultaneous requests.

## 10. Media handling

- PostgreSQL stores metadata and storage keys; binary images and recordings live in file/object storage.
- Define a small server-side storage interface for upload, read, and delete. Local filesystem storage is the first adapter.
- Use generated storage keys outside the public web directory. Validate membership, size, and supported file content before attaching an asset to a post.
- Start photo support with common raster formats. Handle unsupported phone image formats with a clear message before adding conversion.
- Detect browser recording format support; keep recording/playback capability separate from storage. Verify the chosen audio format on target mobile browsers.
- Validate duration through media inspection where practical; a client-side sixty-second timer alone is not authoritative validation.
- Track unattached uploads so canceling a modal or failing a post save does not accumulate permanent orphan files.
- Keep pending-removal media until the Undo period ends. Cleanup must check references and never remove an asset still used by a live post.
- In deployment, account for request upload limits and ephemeral application filesystems. Direct signed uploads can be introduced if the selected host requires them.

## 11. Phased delivery

Each phase ends with a visible demonstration and focused checks. The user can pause or change direction between phases. These are milestones, not promises about duration.

### How to work through a phase

1. Start with the phase's listed tasks and the agreed rules in this document.
2. Implement the smallest working step; keep future-phase features out of the current changes.
3. Verify the relevant behavior and run the applicable checks in section 13.
4. Demonstrate the exit criteria, then check off completed tasks and update the roadmap status.
5. Record unresolved issues before starting the next phase. A phase is not complete just because its code exists.

Phases 1-6 build on one another in order. Later phases use the completed shared frontend and web backend; desktop, mobile, and the map do not technically require every backend experiment to be finished, although the intended learning order is listed above.

### Phase 0 - Align and document

Deliverable: this plan, with agreed rules separated from proposed defaults and future ideas.

- [x] Record product behavior and local development requirements.
- [x] Define monorepo boundaries and the initial data model.
- [x] Break delivery into ordered phases with task checklists and completion criteria.

Exit: a clear first build scope, local development strategy, monorepo boundaries, and phased backlog. No application code in this phase.

### Phase 1 - Repository and local foundation

- [x] Establish pnpm workspaces, TypeScript, formatting/linting, and the Next.js app.
- [x] Configure local PostgreSQL and ignored local media storage; reserve documented Firebase environment variables for Phase 4.
- [x] Add Drizzle configuration, the first migrations, and deterministic sample users/home data as the related tables arrive.
- [x] Provide startup, shutdown, database migration, seed, test, and check scripts. Document Windows prerequisites and ports.
- [x] Add a minimal CI path for typechecking, linting, focused tests, and build; runtime checks use disposable local services.
- [x] Create no Capacitor/Electron runtime or Redis/worker service yet.

Exit: a fresh checkout can start the local website and PostgreSQL following the README, persist data across restarts, and run migrations against an empty database without cloud credentials. Authentication is not implemented in this phase.

### Phase 2 - 3D fridge and touch prototype

- [x] Build the front-facing 3D fridge with local fixture posts.
- [x] Add local selection, modal editing, text colors, dragging, creation layers, and greyed-out appearance.
- [x] Validate mouse, emulated touch, keyboard, small-screen modal layout, and camera framing.
- [x] Establish the coordinate conversion and selection-layer rules before persistence.
- [ ] Complete physical-phone testing of dragging, scrolling, the virtual keyboard, and sample audio; review the visual direction with the user.

Implementation notes and validation boundaries are recorded in [the fridge interaction decision](docs/decisions/0002-fridge-interaction.md). The prototype includes local one-hour removal/Undo/expiry; server-authoritative shared behavior remains Phase 5.

Verified: formatting, lint, TypeScript, 12 unit tests, production build, and 14 browser checks passed. Desktop and phone-sized layouts were also inspected visually. Browser verification used Chromium 149.0.7827.55 with software rendering; physical-device and Safari checks remain pending.

Exit: manipulate example text, photo, and voice-card fixtures on laptop and phone layouts. Fixture state is explicitly temporary; persistent multi-user behavior comes next.

### Phase 3 - Shared frontend foundation

- [x] Create `packages/fridge-ui` as a real workspace package consumed by `apps/web`.
- [x] Move the existing fridge React components, Three.js scene, interaction rules, focused tests, and component styles into the package without redesigning the interface.
- [x] Remove Next.js imports and hard-coded Next.js public-asset assumptions from the shared package. Pass asset locations through the web wrapper.
- [x] Keep the App Router page, layout, fonts, metadata, public fixtures, HTTP routes, and server-only code in `apps/web`.
- [x] Scope shared styles to the fridge application so future platform shells can import them without changing unrelated pages.
- [x] Preserve mouse, touch, keyboard, modal, removal, fallback, and responsive behavior through the extraction.
- [x] Document the platform boundary: Next.js renders the package now; Electron and Capacitor will compile the same React source later and provide native capability adapters when real native features arrive.
- [x] Do not add authentication, persistent post APIs, an API-client package, Electron, Capacitor, or placeholder native interfaces in this phase.

Verified on 2026-09-18: the package and web app typecheck independently, 12 unit tests pass, the production build succeeds, all 14 desktop/emulated-touch browser checks pass, and the desktop layout was visually reviewed through the running Next.js app. The shared package contains no Next.js, Electron, Capacitor, database, or privileged server import.

Exit: the existing Next.js site looks and behaves the same, but its page renders `@noted/fridge-ui`. The shared package has no Next.js, Electron, Capacitor, database, or server-secret dependency and passes the existing focused and browser checks.

### Phase 4 - Identity, homes, and invitations

- [ ] Configure a real Firebase project, connect Google sign-in, and verify Firebase identity tokens on the server.
- [ ] Introduce shared request/response contracts and `packages/api-client` around these first real HTTP operations; make the web frontend use that client.
- [ ] Implement creating/listing homes, creator-only invitations and rename/removal controls, and ordinary member departure.
- [ ] Create the initial fridge board with each new home in one transaction.
- [ ] Support both existing-user invitations and invitations claimed on first matching sign-in.
- [ ] Check membership in routes and services, including stale sessions after removal.

Exit: Alice creates a home, invites Bob, and Bob sees it without accepting. Carol cannot read it. Bob can leave; the creator cannot leave through either UI or API.

### Phase 5 - Persistent shared text notes

- [ ] Connect the 3D scene to the HTTP API and local database.
- [ ] Implement create/edit, shared movement, newest-on-top order, local selection, and last-save-wins saves.
- [ ] Add polling with focus/reconnect handling and error states.
- [ ] Implement one-hour pending removal, shared Undo, and server-authoritative expiry.

Exit: two browser sessions see each other's saved notes and moves through polling. Reload preserves positions. Concurrent saves follow the chosen rule. Expiry and Undo work without a worker.

### Phase 6 - Images and voice; alpha-alpha complete

- [ ] Implement photo upload and display without captions.
- [ ] Implement recording, preview, playback, stop/cancel, and one-minute limit.
- [ ] Add authenticated local media delivery and failed/unattached-upload cleanup.
- [ ] Apply the same movement, modal, removal, and Undo behavior to each post type.
- [ ] Review the complete fridge appearance and phone interactions with realistic sample content.

Exit: the complete local alpha-alpha supports real Google identity through Firebase, automatic invitations, text/photo/voice posts, touch/mouse movement, polling, and slow removal. No Redis, realtime server, cache layer, or job queue is required.

### Phase 7 - First deployment and portfolio demonstration

- [ ] Choose hosting, media storage, budget, and a provisional display name.
- [ ] Configure Neon with pooled application connections and tested migrations.
- [ ] Configure the production Firebase project and its authorized origins; keep local and production configuration separate.
- [ ] Replace the local media adapter with deployed private object storage.
- [ ] Verify two real accounts, membership isolation, media playback, touch, polling, expiry, and cleanup on the hosted app.
- [ ] Document the architecture and the difference between implemented functionality and planned experiments.

Exit: a working hosted web prototype, with costs understood and deployment/recovery instructions. Deployment is a separate action from writing this plan; no services are provisioned here.

### Phase 8 - Backend learning, one capability at a time

#### 8A. WebSockets

Use saved post changes as the first event. Keep HTTP writes and add push notifications that refresh the relevant fridge. Compare against polling, then retain a reconnect/resync fallback. Choose a host that supports persistent connections; do not assume ordinary serverless route invocations can host the socket service.

- [ ] Add the realtime service and authenticated, home-scoped subscriptions.
- [ ] Publish notifications after successful database writes and refresh affected clients.
- [ ] Add reconnect/resync behavior and remove access when membership is revoked.
- [ ] Demonstrate updates and recovery in two browser sessions.

Exit: authorized members receive updates, removed members lose access, and reconnects recover missed changes.

#### 8B. Redis coordination

Add Redis when running multiple realtime instances. Publish changes so members connected to different instances see the same events. Redis Pub/Sub is transient; PostgreSQL remains authoritative and reconnecting clients refetch state.

- [ ] Add local Redis configuration when beginning this phase.
- [ ] Connect two realtime instances through home-scoped change notifications.
- [ ] Verify cross-instance delivery and resynchronization after a Redis outage.

Exit: a two-instance demonstration works and restarting Redis does not lose saved notes.

#### 8C. Caching

Measure a repeated read first, then cache an appropriate result with a clear home-scoped key, TTL, and invalidation policy. Membership checks remain current. Do not serve expired posts just because an old board snapshot is cached; account for the nearest removal deadline.

- [ ] Measure the chosen read path before adding a cache.
- [ ] Implement scoped cache keys, invalidation, and expiry-aware reads.
- [ ] Verify membership removal, cross-home isolation, and the one-hour removal deadline.
- [ ] Compare the result with the baseline and document the benefit.

Exit: demonstrate a measured benefit, correct invalidation, no cross-home data exposure, and correct slow-removal behavior.

#### 8D. Queue and worker

Move physical expired-media cleanup into a background job. Add thumbnail generation only if useful. Use retryable, idempotent work and recheck the post state before deleting media: an Undo can invalidate a previously queued cleanup job.

- [ ] Introduce a queue and a separate worker application.
- [ ] Move eligible expired-media cleanup into jobs that recheck current database state.
- [ ] Add bounded retries, failure visibility, and safe repeated execution.
- [ ] Verify restart recovery and that Undo protects media from stale cleanup jobs.

Exit: jobs survive restarts, retries do not damage live data, and failures are visible. Then document each component's role and operational cost.

### Phase 9 - Electron desktop

- [ ] Create a packaged renderer that imports `fridge-ui`, `api-client`, `contracts`, and `domain` instead of copying frontend code.
- [ ] Implement desktop authentication callback handling, window behavior, recording permissions, and packaging.
- [ ] Keep the renderer isolated from privileged OS APIs; expose only required operations through the preload boundary.

Exit: an installable desktop app uses the same homes and posts, with no local database credentials embedded in the app.

### Phase 10 - Capacitor mobile

- [ ] Create a Capacitor application that imports `fridge-ui`, `api-client`, `contracts`, and `domain` instead of copying frontend code.
- [ ] Configure the web bundle, iOS/Android projects, authentication callbacks, permissions, media picker, and recording plugins.
- [ ] Connect native operations through small capability adapters while keeping ordinary React UI and browser-standard behavior inside `fridge-ui`.
- [ ] Test the shared Three.js scene, touch behavior, modal layout, camera/microphone flows, and performance in real iOS and Android WebViews.

Exit: a device-tested mobile app uses the same backend and product rules. Offline synchronization and push notifications remain separate later features.

### Phase 11 - Map and expanded home

- [ ] Implement the real-world map behavior described below.
- [ ] Add rooms only when there is a concrete second room experience.
- [ ] Preserve home membership as the access boundary across rooms and boards.

Exit: map discovery reveals only the intended public home information, members can enter their own homes, and the original fridge remains usable independently of location permission.

### Phase 12 - Optional family activities

Explore chat, small games, shared activities, or richer personalization only while the project remains enjoyable. Choose one real interaction to design before adding its data model or infrastructure. These are ideas, not commitments for the prototype.

- [ ] Choose one activity and describe how home members use it.
- [ ] Write a small feature-specific plan and completion criteria before implementation.
- [ ] Build and review that activity before selecting another.

Exit: one chosen activity works within the existing home and membership model. Specific acceptance checks are defined when that activity is chosen.

## 12. Future map specification

### Agreed behavior

- A real-world map shows home markers and names publicly by default.
- Nonmembers can inspect the name but cannot see posts or enter the private fridge.
- Each home has one shared pin placed by its creator, not separate member positions.
- Placement should be near the device's reported location, with a little allowance for inaccuracy.
- No member live-location tracking, nearby-person list, chat, or join requests are implied.

### Accuracy and placement rule

There is no fixed browser GPS accuracy. Location can come from GPS or network-derived estimates, and every reading supplies an accuracy value in metres. High-accuracy mode is a request, not a guarantee. [W3C Geolocation specification](https://www.w3.org/TR/geolocation/)

GPS.gov describes smartphone GPS as typically within about 4.9 metres under open sky; surroundings and reception can make it worse. This is an example of favorable conditions, not a universal browser average. [GPS accuracy](https://www.gps.gov/gps-accuracy)

Proposed rule for the map phase:

```text
allowed placement radius = reported accuracy + 20 metres

Example: reported accuracy 12 m -> allowed placement radius 32 m
```

The twenty-metre margin is a product default to tune during device testing. It is not a measured GPS property.

- Request a fresh position and show the reported accuracy circle plus allowed placement area.
- Validate that the chosen pin falls inside that radius using geographic distance, not screen pixels.
- If the reading is too broad to be useful, request a better reading rather than silently allowing a very large placement area. Proposed cutoff: 200 metres reported accuracy; confirm through testing.
- If permission is denied, unavailable, or times out, leave the home usable without a map pin and let the creator retry later. This fallback is proposed, not yet explicitly selected by the user.
- The server can validate submitted coordinates and distance rules, but client-reported location does not prove residence or prevent spoofing.
- Explain in the placement screen that the chosen home pin and home name will be public, matching the requested visibility.
- Store the chosen home position and only the measurement metadata actually needed; do not record movement history.

Map provider, tile costs, precise cutoff, ability to relocate a pin, location freshness window, and marker clustering remain decisions for that phase. Do not add a geospatial extension or map dependency before there is a query that needs it.

## 13. Validation strategy

Focus tests on product behavior and boundaries rather than mirroring every implementation function.

- Integration tests against disposable PostgreSQL: migrations, constraints, home creation transaction, invitations, member removal, and last-save-wins saves.
- Unit tests around the server authentication boundary, plus focused integration checks with real Firebase test accounts: stable identity, verified-email invitation matching, and rejection of unauthenticated callers.
- Home isolation: no reading/editing another home's posts or media through guessed identifiers.
- Removal clock tests: before/at/after deadline, restart, repeated removal, Undo race, edit rejection, and safe physical cleanup.
- Multi-session browser checks: shared positions, locally raised selection, polling, stale responses, and membership revocation.
- Media checks: invalid/oversized content, duration, canceled upload, recorder permissions, playback, and expiry.
- Visual/interaction checks on desktop and touch: tap versus drag, overlapping cards, small-screen modal layout, focus, and render failure behavior.
- Shared-frontend boundary checks in Phase 3: `fridge-ui` typechecks independently, imports no platform/server modules, and the existing web browser checks pass through the package entry point.
- Typecheck, lint, focused tests, and production build for each relevant implementation milestone. Phase 2 also has production-browser checks for desktop and emulated touch.
- A real-device pass is required before claiming phone recording and touch support work; viewport emulation alone is insufficient.

## 14. Scope discipline and remaining choices

The alpha-alpha ends at Phase 6. It does not include map discovery, extra rooms, Electron, Capacitor, WebSockets, Redis, caching infrastructure, queues, workers, chat, or games.

Prepared architecture means explicit shared contracts and runtime boundaries. It cannot remove future platform setup, OAuth registration, mobile build requirements, desktop packaging, or hosting decisions.

Still adjustable without reopening the product vision:

- Final fridge materials, magnets, color palette, and font.
- Package versions, PostgreSQL version, device test targets, and local Docker/native setup based on the development machine.
- Hosting provider, object storage provider, deployment budget, and public product name.
- Map accuracy margin/cutoff and permission fallback, to confirm in the map phase.
- Electron build/distribution details and the exact Capacitor plugins and native project configuration, in their respective phases.

Keep the working product useful at every milestone. Introduce each later backend technology with a concrete feature, a verification example, and an explanation of why it exists.

## 15. Technical references

Initially checked during planning on 2026-09-16; the Capacitor/Electron frontend boundary was confirmed on 2026-09-17. Recheck version-dependent setup when implementing.

- [Drizzle with PostgreSQL and node-postgres](https://orm.drizzle.team/docs/get-started/postgresql-new) - local and hosted PostgreSQL access through the same driver family.
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations) - checked-in schema changes.
- [Neon connection pooling](https://neon.com/blog/pgbouncer-the-one-with-prepared-statements) - pooled connections for application workloads.
- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) - real Google identity in local and deployed environments.
- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens) - server-side identity verification.
- [React Three Fiber introduction](https://r3f.docs.pmnd.rs/) - React integration and version compatibility considerations.
- [Capacitor documentation](https://capacitorjs.com/docs) - adding a native runtime and plugin APIs to an existing modern web application.
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model) - web-based renderers plus isolated main/preload responsibilities.
- [W3C Geolocation specification](https://www.w3.org/TR/geolocation/) - per-reading location accuracy and device-location behavior.
- [GPS.gov accuracy guidance](https://www.gps.gov/gps-accuracy) - typical smartphone GPS accuracy in open-sky conditions.
