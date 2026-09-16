import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

config({ path: path.resolve(packageDirectory, "../../.env"), quiet: true });

export function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing. Run `pnpm local:setup` from the repository root.",
    );
  }

  return databaseUrl;
}
