# PowerSync setup

The native shells bundle shared illustrated screens with SQLite reads and
local-first text/media writes. See [native client setup](../packages/native-client/README.md).
The browser uses the same presentation with online reads and writes.

## Service configuration

Create a development PowerSync instance and connect it to a development PostgreSQL database with logical replication enabled. The source database must have the repository's schema before validating streams. Production Vercel releases now apply committed Drizzle migrations automatically before publishing the app; local databases use `pnpm db:migrate`. See [database releases](../docs/deployment.md#database-releases-automatic). The source connection must use replication credentials; those credentials never belong in an app bundle.

For a new connection, create the explicit replication publication in that source
database after applying migrations (skip this if PowerSync setup already created
it):

```sql
CREATE PUBLICATION powersync FOR TABLE
  public.users, public.home_memberships, public.homes, public.boards,
  public.posts, public.reels, public.book_entries, public.media_assets,
  public.note_revisions;
```

Migration `0005_powersync_media_publication` adds the media and revision tables to
an existing publication. It tolerates tables already included and skips databases
without a PowerSync publication, such as isolated tests. It does not replace an
existing publication or include receipts and worker intents. Run `pnpm db:migrate`
against the configured development source before validating updated streams;
production applies the same migration during its existing release step. The
migration role must own the publication and tables.

Deploy [sync-config.yaml](./sync-config.yaml) to that instance. This configuration maps the verified Firebase UID through `users.auth_subject` into current home memberships. Board, home/month, and note/month subscriptions further narrow those authorized rows. Deleted items are retained as server tombstones but excluded from the synced visible view. Note history has its own authorized read stream; receipts and worker intents are never included. Client writes use the backend's validated operations, rather than trusting stream access to authorize writes.

Configure Firebase authentication on the service:

- JWKS URI: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`
- JWT audience: the Firebase project ID.

The native connector binds the Firebase account, its database, and its typed tRPC
client together. It calls `sync.configuration` for the endpoint and
`sync.applyNote` for queued operations. Set `POWERSYNC_URL` in root `.env` locally
and in the backend's Vercel environment. The local backend must use the same Neon
source database as this instance; Docker PostgreSQL remains available for tests.

The client subscribes to `board_notes` with `{ board_id: boardId }`, `home_media`
with `{ home_id: homeId, month: 'YYYY-MM' }`, and `note_history` by note/month.
`media_item` pins pending targets and originals. It watches local data and renders
outcomes and revocation notices. Retention and device acceptance are described in
the native guide.

This configuration follows the official [Firebase authentication](https://docs.powersync.com/configuration/auth/firebase-auth), [Sync Streams](https://docs.powersync.com/sync/streams/quickstart), and [CTE](https://docs.powersync.com/sync/streams/ctes) documentation. Complete live authorization and replication tests before treating the instance as verified.

## Local checks

```powershell
docker compose up -d postgres redis
$env:NOTED_SYNC_TEST_DATABASE_URL = 'postgresql://noted:noted@localhost:5434/noted_sync_test'
pnpm exec vitest run packages/offline/src/persistence.test.ts packages/api/src/sync.integration.test.ts
```

The PostgreSQL tests create a randomly named temporary database, run the real migrations, and remove that test database afterward. They reject non-local database URLs. The SQLite tests use the real PowerSync Node SDK and the same common schema/connector intended for platform SDKs. Temporary database files are removed after each test. Backend tests skip when the explicit test URL is absent; CI supplies it.

These tests prove local persistence and the backend write protocol separately. They do not prove service replication, native cold startup, Android persistence, packaged Electron execution, account switching, media durability, or physical removal of revoked-home cached rows. Revoked work is hidden immediately by the local marker and removed from delivery; canonical local rows must be reconciled away by the authorized sync stream. The platform slice must verify that checkpoint rather than claiming hiding alone purges storage.
