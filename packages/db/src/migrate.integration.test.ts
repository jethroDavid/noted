import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrate";

const testUrl = process.env.NOTED_SYNC_TEST_DATABASE_URL;
const name = `noted_sync_test_${randomUUID().replaceAll("-", "")}`;
let administrator: Pool;
let database: Pool;
let connectionString: string;
let directory: string;
const execFileAsync = promisify(execFile);
const expectedMigrations = readMigrationFiles({
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
}).length;

describe.skipIf(!testUrl)("serialized deployment migrations", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !url.pathname.startsWith("/noted_sync_test")
    )
      throw new Error(
        "Migration tests require an explicitly named local test database URL.",
      );
    url.pathname = "/postgres";
    administrator = new Pool({ connectionString: url.href });
    await administrator.query(`CREATE DATABASE "${name}"`);
    url.pathname = `/${name}`;
    connectionString = url.href;
    database = new Pool({ connectionString });
    directory = await mkdtemp(join(tmpdir(), "noted-migrations-"));
  });

  afterAll(async () => {
    await database?.end();
    if (administrator) {
      if (!/^noted_sync_test_[a-f0-9]{32}$/.test(name))
        throw new Error("Unexpected test database.");
      await administrator.query(
        `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
      );
      await administrator.end();
    }
    if (directory) {
      if (
        dirname(resolve(directory)) !== resolve(tmpdir()) ||
        !basename(directory).startsWith("noted-migrations-")
      )
        throw new Error("Unexpected test directory.");
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("allows overlapping releases to apply the real migrations exactly once", async () => {
    await Promise.all([
      applyMigrations(connectionString),
      applyMigrations(connectionString),
      applyMigrations(connectionString),
    ]);
    const result = await database.query(
      "SELECT * FROM drizzle.__drizzle_migrations",
    );
    expect(result.rowCount).toBe(expectedMigrations);
    const columns = await database.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'posts'",
    );
    expect(
      columns.rows.map((row: { column_name: string }) => row.column_name),
    ).toEqual(expect.arrayContaining(["revision", "deleted_at"]));
    await applyMigrations(connectionString);
    expect(
      (await database.query("SELECT * FROM drizzle.__drizzle_migrations"))
        .rowCount,
    ).toBe(expectedMigrations);
  }, 20_000);

  it("runs the actual deployment CLI against the isolated database", async () => {
    const result = await execFileAsync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "src/migrate.ts"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
          MIGRATION_DATABASE_URL: "",
        },
      },
    );
    expect(result.stdout).toContain("Database migrations complete.");
    expect(
      (await database.query("SELECT * FROM drizzle.__drizzle_migrations"))
        .rowCount,
    ).toBe(expectedMigrations);
  }, 20_000);

  it("extends an existing PowerSync publication without exposing server-only tables", async () => {
    await database.query(
      "CREATE PUBLICATION powersync FOR TABLE public.users, public.home_memberships, public.homes, public.boards, public.posts",
    );
    const sql = await readFile(
      new URL(
        "../drizzle/0005_powersync_media_publication.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await database.query(sql);
    await database.query(sql); // Safe when an operator already added the tables.
    const result = await database.query<{ tablename: string }>(
      "SELECT tablename FROM pg_publication_tables WHERE pubname = 'powersync' AND schemaname = 'public' ORDER BY tablename",
    );
    expect(result.rows.map((row) => row.tablename)).toEqual([
      "boards",
      "book_entries",
      "home_memberships",
      "homes",
      "media_assets",
      "note_revisions",
      "posts",
      "reels",
      "users",
    ]);
  });

  it("rolls back failed SQL and releases the lock so a corrected release can retry", async () => {
    await mkdir(join(directory, "meta"));
    await writeFile(
      join(directory, "meta", "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: [
          {
            idx: 0,
            version: "7",
            when: 9_000_000_000_000,
            tag: "0000_release_probe",
            breakpoints: true,
          },
        ],
      }),
    );
    const sqlFile = join(directory, "0000_release_probe.sql");
    await writeFile(
      sqlFile,
      "CREATE TABLE release_probe (id integer);\n--> statement-breakpoint\nSELECT * FROM missing_release_probe_table;",
    );
    await expect(
      applyMigrations(connectionString, directory),
    ).rejects.toThrow();
    expect(
      (
        await database.query(
          "SELECT to_regclass('public.release_probe') AS table_name",
        )
      ).rows[0].table_name,
    ).toBeNull();
    expect(
      (await database.query("SELECT * FROM drizzle.__drizzle_migrations"))
        .rowCount,
    ).toBe(expectedMigrations);
    await writeFile(sqlFile, "CREATE TABLE release_probe (id integer);");
    await applyMigrations(connectionString, directory);
    expect(
      (
        await database.query(
          "SELECT to_regclass('public.release_probe') AS table_name",
        )
      ).rows[0].table_name,
    ).toBe("release_probe");
    expect(
      (await database.query("SELECT * FROM drizzle.__drizzle_migrations"))
        .rowCount,
    ).toBe(expectedMigrations + 1);
  }, 20_000);
});
