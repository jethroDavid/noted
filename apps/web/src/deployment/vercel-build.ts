import "server-only";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureWorkerSchedules } from "@noted/queue/src";

interface BuildOperations {
  build(): void | Promise<void>;
  migrate(): void | Promise<void>;
  configureWorkers?(): void | Promise<void>;
}

export async function runVercelBuild(
  environment: string | undefined,
  operations: BuildOperations,
): Promise<void> {
  if (!["production", "preview", "development"].includes(environment ?? "")) {
    throw new Error(
      "VERCEL_ENV must identify production, preview, or development. Use the ordinary build command locally.",
    );
  }
  // Failed compilation must not touch the production database. Vercel
  // publishes only after this entire command exits successfully.
  await operations.build();
  if (environment === "production") {
    await operations.migrate();
    await operations.configureWorkers?.();
  } else {
    console.log(
      "Skipping database migrations for this non-production deployment.",
    );
  }
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.error || result.status !== 0)
    throw new Error("Release step failed. Deployment stopped.");
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const require = createRequire(import.meta.url);
    await runVercelBuild(process.env.VERCEL_ENV, {
      configureWorkers: ensureWorkerSchedules,
      build: () =>
        run(process.execPath, [require.resolve("next/dist/bin/next"), "build"]),
      migrate: () =>
        run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
          "--filter",
          "@noted/db",
          "migrate:deploy",
        ]),
    });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Deployment failed.",
    );
    process.exitCode = 1;
  }
}
