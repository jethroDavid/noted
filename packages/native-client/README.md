# Native offline client

The Android and Windows shells bundle the shared illustrated fridge, TV, and
photobook from `packages/experience`. They supply Firebase Auth, SQLite, durable
media storage, and system-browser opening. Content reads come from watched local
SQLite; text and media changes save locally before delivery. The browser uses the
same presentation with its online tRPC data path. Home creation stays on the web;
membership management uses the existing online API.

## Local development

1. Set root `.env` `DATABASE_URL` to the development Neon branch connected to the
   PowerSync Development instance. Set `POWERSYNC_URL` to its Connect URL. Use
   separate branches and instances for production. Cloud PowerSync cannot
   replicate writes made to Docker PostgreSQL.
2. Run `pnpm db:migrate`, deploy [the sync streams](../../powersync/sync-config.yaml),
   and start Redis/object storage (`docker compose up -d redis minio`). Apply the
   existing local bucket setup if this is the first MinIO start.
3. Run `pnpm --filter @noted/web dev --webpack` for the backend on port 3000.
   Webpack avoids the existing local Turbopack CSS worker startup failure.
4. Desktop: `pnpm --filter @noted/desktop dev`. Android: connect a device,
   `adb reverse tcp:3000 tcp:3000`, then `pnpm --filter @noted/mobile run:local`.
   Also run `adb reverse tcp:9000 tcp:9000` when using local MinIO. Reverse both
   ports again after reconnecting. Development builds default to
   `http://localhost:3000`; `NATIVE_API_URL` overrides it.
5. Browser preview of this workspace: `pnpm --filter @noted/mobile dev`, then
   visit `http://localhost:5173`. The web storage fallback does not prove Android
   plugin behavior.

`firebase-public.json` contains four public Firebase client settings, also
embedded in the website. These are not Admin credentials. Root
`NEXT_PUBLIC_FIREBASE_*` values override them. Native builds embed only those
four settings, the backend URL, and an optional PowerSync endpoint. Database,
Admin, Redis, and storage credentials never enter the renderer.

A copied Neon branch includes media references, not the original objects. When
using fresh local MinIO, older uploads may be absent even though their metadata
syncs successfully. Use new development uploads or explicitly provision a separate
development copy of the required objects; changing the database URL alone cannot
make those originals available. Two preexisting Home photos were confirmed absent
from the configured storage during this checkpoint.

Ordinary native builds target the production backend. Set `NATIVE_RELEASE_API_URL`
and optionally `NATIVE_RELEASE_POWERSYNC_URL` for another release environment.
The backend must include native sign-in and CORS support before releasing these
clients. No additional Firebase provider or Android OAuth client is required.

## Runtime

The app opens an account-and-backend-specific SQLite file before networking.
Firebase retains the signed-in account across restarts. PowerSync obtains its
endpoint and current Firebase ID token when connecting and retries independently
of local startup. An endpoint mismatch fails visibly.

Authorized homes/boards sync automatically. Opening a home subscribes to its
text, current photos/reels, and the current UTC archive month, retaining released
views for seven days. Earlier memories requests older months. Pending boards and
media targets remain pinned until delivery. History is requested by note/month.
Text creates, edits, and guarded deletes all use `saveNoteOperation`:
note, pending marker, and stable metadata commit atomically. Watched SQLite
queries render the result. The connector removes accepted pending markers,
retains work on transport failures, and persists recoverable text outcomes.
Revoked-home work follows the agreed discard-and-notify policy.

Originals persist before their metadata is acknowledged locally. Stable asset and
operation IDs survive restarts. The PowerSync attachment queue transfers bytes
separately from the metadata queue, using checksum-bound tickets and retryable
server verification. Android transfers and displays persisted originals through
native filesystem/file-transfer plugins; desktop uses account-scoped OPFS.
Variant processing has a durable PostgreSQL work intent and periodic recovery.
Production builds upsert QStash schedules; local development needs the existing
QStash worker setup, and a manual reconcile trigger when testing scheduled repair.

The initial media file budget is 256 MiB across account directories. Eviction
removes accepted, invisible, unpinned files from the current account; it never
discards pending originals. Other accounts' files are conservatively protected,
so switching back may be needed to evict their eligible cache. When protected data
fills the budget, saving fails visibly. Metadata views use stream TTLs rather than
a byte cap. Cache misses require connectivity. The UI requests bytes for visible
media and keeps usable local originals while server variants are processing.

Sign-in opens `/native-auth` in the system browser. The user compares the code
and approves an account. A five-minute Redis record binds that approval to the
app's secret verifier. Only that app can exchange it for a marked Firebase custom
token. Lost replies can retry without changing the approved identity. Firebase
Admin rechecks enabled status, verified email, and the Google provider before
issuing it. Bearer tokens never enter browser URLs.

Logout offers sync first, retain local work, or cancel. Waiting is bounded and
failure leaves the account signed in. The connector pauses before credentials
are removed. Another account opens a different database. Closing does not erase
files. Sync-first waits for metadata and original verification, not variants;
unresolved outcomes block it. Confirmed revocation purges that home's local media
and preserves a notice. Canonical rows reconcile through authorized sync streams.
Diagnostics export requires an explicit click and consent; it contains bounded
safe failure codes and operation IDs, excluding note payloads, tokens, and URLs.

## Checks

`apps/desktop/test/storage.html`, served with desktop Vite, is an isolated fixture
using the actual OPFS adapter and shared note mutations. It never contacts auth
or a backend. Save, reload, and switch Alice/Bob to check durable rows, operation
IDs, pending queues, and account separation. It is excluded from production builds.

Tests cover real SQLite/file restart persistence, metadata delivery during a held
original upload, lost confirmation, native transfer delegation, protected-cache
eviction, revocation purge, and orphan grace. Backend integration tests use real
PostgreSQL and MinIO for idempotent media acceptance, verification, guarded
removal/restoration, and cleanup. Live native browser text/photo sync was checked
against development Neon/PowerSync. Physical Android and packaged Windows cold
offline startup, account switching, and maximum-video memory remain separate
acceptance checks; builds and adapter tests do not establish those passes.
