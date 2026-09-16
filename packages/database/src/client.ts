import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDatabaseUrl } from "./environment";
import * as schema from "./schema";

type DatabaseGlobals = typeof globalThis & {
  notedPool?: Pool;
};

const databaseGlobals = globalThis as DatabaseGlobals;

function createPool(): Pool {
  const configuredMaximum = Number(process.env.DATABASE_POOL_MAX ?? "5");

  if (!Number.isInteger(configuredMaximum) || configuredMaximum < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer.");
  }

  return new Pool({
    connectionString: requireDatabaseUrl(),
    max: configuredMaximum,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const pool = databaseGlobals.notedPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  databaseGlobals.notedPool = pool;
}

export const database = drizzle({ client: pool, schema });
