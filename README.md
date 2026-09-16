# Noted

Noted is a shared family fridge for text notes, photos, and voice messages. The project starts as a Next.js web app and will later add Electron desktop and Expo mobile clients around shared application rules and API contracts.

Phase 1 establishes the local development foundation. See [PLAN.md](./PLAN.md) for the product decisions and the full phase roadmap.

## Prerequisites

- Node.js 24 (the exact local version is in `.nvmrc`)
- pnpm 10
- Docker Desktop with Linux containers
  No Neon account, Firebase cloud project, or storage account is required until the phase that implements the related integration.

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

- Web app: <http://localhost:3000>
- Database health check: <http://localhost:3000/api/health>

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

```text
apps/web              Next.js browser app and HTTP routes
packages/contracts    Public API schemas and types
packages/domain       Pure rules shared by future clients and services
packages/database     Server-only Drizzle schema, migrations, pool, and seed
packages/config       Shared TypeScript configuration
```

Browser and future desktop/mobile code may use `contracts` and `domain`. Database code stays server-side. More packages are added only when a phase gives them a real responsibility.

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
- Real Google sign-in will use a Firebase project in Phase 3. Local web development will connect to that online authentication service once configured.
