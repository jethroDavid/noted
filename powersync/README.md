# PowerSync setup

The first implementation adds the note protocol and local SQLite library. It does not yet replace the native app startup or wire the existing screens to local reads. Photos, video, and their workers keep their current implementation until the media slice.

## Service configuration

Create a development PowerSync instance and connect it to a development PostgreSQL database with logical replication enabled. The source database must have the repository's schema before validating streams. Production Vercel releases now apply committed Drizzle migrations automatically before publishing the app; local databases use `pnpm db:migrate`. See [database releases](../docs/deployment.md#database-releases-automatic). The source connection must use replication credentials; those credentials never belong in an app bundle.

Deploy [sync-config.yaml](./sync-config.yaml) to that instance. This configuration maps the verified Firebase UID through `users.auth_subject` into current home memberships. Board subscriptions further narrow those authorized rows. Deleted notes are retained as server tombstones but excluded from the synced visible view. Receipt and history tables are not client writable or included in these streams.

Configure Firebase authentication on the service:

- JWKS URI: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`
- JWT audience: the Firebase project ID.

The shell's connector uses the signed-in account's current Firebase ID token. It must bind that account, its database, and its typed tRPC client together. Call `sync.configuration` to obtain the configured endpoint and `sync.applyNote` to apply each queued domain operation. Set `POWERSYNC_URL` on the backend once the instance is configured.

Subscribe to `board_notes` with `{ board_id: boardId }` for an opened board. Keep subscriptions needed by pending mutations until reconciliation completes. The app must watch local data and render local outcomes/revocation notices; these screen and account-lifecycle integrations are the next checkpoint.

This configuration follows the official [Firebase authentication](https://docs.powersync.com/configuration/auth/firebase-auth), [Sync Streams](https://docs.powersync.com/sync/streams/quickstart), and [CTE](https://docs.powersync.com/sync/streams/ctes) documentation. It has not been validated or deployed against a live PowerSync instance yet.

## Local checks

```powershell
docker compose up -d postgres redis
$env:NOTED_SYNC_TEST_DATABASE_URL = 'postgresql://noted:noted@localhost:5434/noted_sync_test'
pnpm exec vitest run packages/offline/src/persistence.test.ts packages/api/src/sync.integration.test.ts
```

The PostgreSQL tests create a randomly named temporary database, run the real migrations, and remove that test database afterward. They reject non-local database URLs. The SQLite tests use the real PowerSync Node SDK and the same common schema/connector intended for platform SDKs. Temporary database files are removed after each test. Backend tests skip when the explicit test URL is absent; CI supplies it.

These tests prove local persistence and the backend write protocol separately. They do not prove service replication, native cold startup, Android persistence, packaged Electron execution, account switching, media durability, or physical removal of revoked-home cached rows. Revoked work is hidden immediately by the local marker and removed from delivery; canonical local rows must be reconciled away by the authorized sync stream. The platform slice must verify that checkpoint rather than claiming hiding alone purges storage.
