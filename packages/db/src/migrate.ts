import "server-only";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

interface MigrationEnvironment {
  DATABASE_URL?: string;
  MIGRATION_DATABASE_URL?: string;
}

class MigrationConfigurationError extends Error {}

// Neon uses the same endpoint/credentials with a -pooler hostname suffix
// for transaction pooling. Migration locks require its direct endpoint.
export function migrationConnectionString(
  environment: MigrationEnvironment,
): string {
  const value = environment.MIGRATION_DATABASE_URL || environment.DATABASE_URL;
  if (!value)
    throw new MigrationConfigurationError(
      "DATABASE_URL or MIGRATION_DATABASE_URL is required for migrations.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MigrationConfigurationError(
      "The migration database URL is invalid.",
    );
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new MigrationConfigurationError(
      "Migrations require a PostgreSQL connection URL.",
    );
  }
  if (url.hostname.endsWith(".neon.tech")) {
    const labels = url.hostname.split(".");
    labels[0] = labels[0]!.replace(/-pooler$/, "");
    url.hostname = labels.join(".");
  }
  return url.href;
}

export const migrationLockId = 0x4e4f5445;

export async function applyMigrations(
  connectionString: string,
  migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url)),
): Promise<void> {
  // One persistent session holds the lock across Drizzle's journal lookup
  // and transaction. Never use the application connection pool here.
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 120_000,
    lock_timeout: 60_000,
  });
  try {
    await client.connect();
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    // Closing releases the advisory lock on both success and failure.
    await client.end();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const connectionString = migrationConnectionString(process.env);
    console.log("Applying pending database migrations...");
    await applyMigrations(connectionString);
    console.log("Database migrations complete.");
  } catch (error) {
    // Configuration errors are ours and contain no connection values.
    // Avoid logging connection objects/credentials from driver failures.
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
    const detail =
      error instanceof MigrationConfigurationError
        ? ` ${error.message}`
        : code
          ? ` (${code})`
          : "";
    console.error(`Database migration failed.${detail} Deployment stopped.`);
    process.exitCode = 1;
  }
}
