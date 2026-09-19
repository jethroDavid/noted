# Noted

Noted is a shared family fridge for text notes, photos, and voice messages. Next.js is the first platform shell and the initial HTTP backend. The React fridge lives in a shared package that future Electron desktop and Capacitor mobile clients will compile into their own applications.

Phases 2 and 3 implement the interactive fridge playground and its shared frontend boundary. Phase 4 adds Google identity, homes, and invitations; live Firebase account review remains pending. See [PLAN.md](./PLAN.md) for the product decisions and the full phase roadmap.

## Try the fridge

Run `pnpm dev` and open [localhost:3000/app](http://localhost:3000/app). The root URL redirects there. The Phase 2 playground works without starting PostgreSQL. Drag a post to move it; click or tap to open its modal. The toolbar creates text notes or adds sample photo/voice cards. Use Tab, arrow keys, and Enter for keyboard interaction.

Changes are temporary and reset on refresh. Removing a post greys it out for exactly one hour, with Undo available by opening the post. Sign in from the playground to open the [home switcher](http://localhost:3000/app/homes); posts inside shared homes are still playground fixtures until Phase 5. Uploads and recording come in Phase 6. The 3D scene has a usable simple-view fallback.

The palette button at the fridge's upper right switches between Sage classic, Butter retro, and Blue duo. Switching keeps notes and their positions; the choice resets on refresh. See [fridge models](./docs/design/fridge-models.md) for the model structure and how to add a design.

The [interaction decision](./docs/decisions/0002-fridge-interaction.md) describes rendering, coordinates, layer order, and the remaining physical-phone review.

Posts can move across almost the whole fridge front, including the upper door and near the edges. The fridge retains its original size, with tools below. Text, photo, and voice each have separate card and modal components in `packages/fridge-ui/src/posts` and `packages/fridge-ui/src/modals`. They share the card interaction wrapper and `PostModalFrame` template.

## Browser checks

```powershell
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

The tests start their own production server on port 3100 and cover desktop and emulated touch. `pnpm check` includes the focused unit tests; browser tests run separately. If a managed browser already exists locally, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select its executable. This machine uses a cached Chromium installation because the matching browser download timed out. CI installs Playwright's matching Chromium.

Physical phone validation remains pending. Test card dragging, scrolling, modal editing with the virtual keyboard, and sample audio on an actual phone before treating touch support as device-verified.

## Prerequisites

- Node.js 24 (the exact local version is in `.nvmrc`)
- pnpm 10
- Docker Desktop with Linux containers
  A Firebase project is required to use shared homes; the public fridge playground still works without one. No Neon or storage account is needed yet.

## First local setup

From the repository root:

```powershell
pnpm install
pnpm local:setup
pnpm dev:services
pnpm db:migrate
pnpm db:seed
```

Then start the local app:

```powershell
pnpm dev:all
```

Open:

- Web app and playground: <http://localhost:3000/app>
- Database health check: <http://localhost:3000/api/health>
- Home switcher after Firebase setup: <http://localhost:3000/app/homes>

## Connect real Google sign-in

Phase 4 uses online Firebase Authentication even when PostgreSQL runs locally. This checkout has a Firebase web app and Google provider configured in the ignored local `.env`; open `/app` and choose **Sign in**. Successful sign-in opens `/app/homes`. The steps below are for a fresh clone or another developer's machine. Without Firebase configuration, `/app` remains an interactive fridge playground and its sign-in action explains what is missing.

1. Create a Firebase project, register a web app, and enable **Authentication → Sign-in method → Google**. In Authentication settings, add `localhost` to **Authorized domains** if it is not present.
2. Copy the web app's API key, auth domain, project ID, and app ID into the matching `NEXT_PUBLIC_FIREBASE_*` entries in `.env`. Set `FIREBASE_PROJECT_ID` to the same project ID. The `NEXT_PUBLIC_` values are browser configuration, not secrets.
3. In **Project settings → Service accounts**, generate a private key. Save the JSON under the ignored `.local/` directory and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to its absolute path. Never commit or paste this JSON into the repository.
4. Remove any older `FIREBASE_AUTH_EMULATOR_HOST` or `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` lines from `.env`. Restart `pnpm dev:all`, open `/app`, and choose **Sign in** to continue with Google.

The Firebase CLI configuration used for this local setup is kept under the ignored `.local/firebase-config/` directory so the OAuth support email stays out of commits. Use an explicit `--config .local/firebase-config/firebase.json` path when updating that provider from this checkout.

Create a home, invite a second Google account by its email, and sign in from `/app` in another browser profile with that account. The home appears automatically in the switcher. A third account cannot open it. The creator can rename and remove members; a member can leave. Creator departure and ownership transfer are intentionally unavailable.

The server verifies Firebase ID tokens for every home request and checks current PostgreSQL membership. The first home API client is in `packages/api-client`; the home screens are in `packages/fridge-ui`. The Next.js app supplies Firebase authentication and HTTP routes. A user who loses membership cannot read that home on the next request. The UI refreshes visible home membership every 15 seconds and on focus.

Run the local PostgreSQL integration check after migrations:

```powershell
$env:RUN_DB_TESTS='1'
node --env-file=.env node_modules/vitest/vitest.mjs run packages/server/src/homes.test.ts
```

This check uses temporary, uniquely named records and removes them afterward. It does not need Firebase credentials; the live two-account review still does.

`pnpm dev:all` prepares local folders, starts PostgreSQL, applies migrations, and runs the web app. Seeding is intentionally separate so normal startup never changes application data.

## Common commands

| Command              | Purpose                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| `pnpm local:setup`   | Create `.env` from the example when missing and prepare ignored local data folders |
| `pnpm dev:services`  | Start local PostgreSQL and wait for it to become healthy                           |
| `pnpm services:down` | Stop local services while preserving the database volume                           |
| `pnpm dev`           | Run the Next.js app                                                                |
| `pnpm dev:all`       | Start the normal local development stack                                           |
| `pnpm db:generate`   | Generate a checked-in SQL migration after changing the Drizzle schema              |
| `pnpm db:migrate`    | Apply pending migrations                                                           |
| `pnpm db:seed`       | Upsert deterministic example users, home, memberships, and fridge board            |
| `pnpm db:studio`     | Open Drizzle Studio for the local database                                         |
| `pnpm check`         | Run formatting, lint, types, tests, and the production web build                   |

## Local data

- PostgreSQL data persists in the Docker volume named `noted_postgres-data`.
- Future local image and voice uploads live under `.local/uploads/`.
- `.env` and everything under `.local/` are ignored by Git.

To reset only the local PostgreSQL database, stop the stack and explicitly remove its volume:

```powershell
docker compose down --volumes
```

This permanently removes local database contents. The normal `pnpm services:down` command keeps them.

## Local container boundary

Only PostgreSQL runs in Docker during Phase 1. Its port is bound to `127.0.0.1`, its root filesystem is read-only, temporary paths use memory-backed filesystems, privileges cannot be increased, and process, memory, and CPU limits are set. The database volume is the only intentional persistent container state.

The official PostgreSQL image initializes volume ownership before switching to its unprivileged `postgres` user, so the Compose service does not drop every Linux capability during first-time initialization. No Docker socket, host network, host process namespace, privileged mode, or public port is used. The Next.js production image is deferred until a deployment target exists.

## Workspace boundaries

Icon additions and redesigns follow the [icon design guidelines](./docs/design/icons.md), which document the current interface and brand styles and include reusable prompts. Repository-wide instructions in [AGENTS.md](./AGENTS.md) point agents to this guide.

```text
apps/web              Next.js platform shell, public assets, and HTTP routes
packages/fridge-ui    Shared React UI, Three.js scene, interactions, and styles
packages/contracts    Public API schemas and types
packages/api-client   Browser-safe authenticated HTTP calls
packages/domain       Pure rules shared by future clients and services
packages/server       Server-only identity, home services, and access checks
packages/database     Server-only Drizzle schema, migrations, pool, and seed
packages/config       Shared TypeScript configuration
```

The web shell renders `fridge-ui` and supplies its platform asset locations. Future Electron and Capacitor shells will compile the same package. Browser and future desktop/mobile code may use `fridge-ui`, `contracts`, `domain`, and `api-client`. `server` and `database` stay on the backend.

## Database changes

1. Change `packages/database/src/schema.ts`.
2. Run `pnpm db:generate`.
3. Review the generated SQL in `packages/database/drizzle/`.
4. Run `pnpm db:migrate` against a local database.
5. Commit the schema and generated migration together.

Application code uses a small `pg` connection pool. Local development connects to local PostgreSQL; deployment will point the same Drizzle code at Neon's pooled endpoint.

## Troubleshooting

- If PostgreSQL does not start, open Docker Desktop and confirm it is using Linux containers.
- Noted uses host port `55432` for PostgreSQL to avoid common conflicts with other local databases. If port `55432` or `3000` is occupied, stop the conflicting process or deliberately update `.env`.
- If database commands report a missing URL, run `pnpm local:setup` and review `.env`.
- If the `/app` sign-in action says Google sign-in is not configured, complete the Firebase settings above and restart Next.js. Projects created after April 2025 may need `localhost` added manually as an authorized domain.
