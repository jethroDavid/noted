import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { database, pool } from "./client";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

try {
  await migrate(database, {
    migrationsFolder: path.join(packageDirectory, "drizzle"),
  });
  console.log("Database migrations are up to date.");
} finally {
  await pool.end();
}
