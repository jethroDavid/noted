import { describe, expect, it, vi } from "vitest";
import { runVercelBuild } from "./vercel-build";

describe("production release gate", () => {
  it("waits for compilation before touching the database and waits for migration before success", async () => {
    const stages: string[] = [];
    let finishBuild!: () => void;
    let finishMigration!: () => void;
    const build = new Promise<void>((resolve) => {
      finishBuild = resolve;
    });
    const migration = new Promise<void>((resolve) => {
      finishMigration = resolve;
    });
    const release = runVercelBuild("production", {
      build: async () => {
        stages.push("build");
        await build;
      },
      migrate: async () => {
        stages.push("migrate");
        await migration;
      },
    }).then(() => {
      stages.push("release-ready");
    });
    expect(stages).toEqual(["build"]);
    finishBuild();
    await vi.waitFor(() => expect(stages).toEqual(["build", "migrate"]));
    finishMigration();
    await release;
    expect(stages).toEqual(["build", "migrate", "release-ready"]);
  });

  it("does not migrate when the build fails", async () => {
    const migrate = vi.fn();
    await expect(
      runVercelBuild("production", {
        build: async () => {
          throw new Error("Compilation failed");
        },
        migrate,
      }),
    ).rejects.toThrow("Compilation failed");
    expect(migrate).not.toHaveBeenCalled();
  });

  it("fails the release when a migration fails", async () => {
    const publish = vi.fn();
    await expect(
      runVercelBuild("production", {
        build: vi.fn(),
        migrate: async () => {
          throw new Error("Migration failed");
        },
      }).then(publish),
    ).rejects.toThrow("Migration failed");
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["preview", "development"])(
    "builds %s without running production migrations",
    async (environment) => {
      const build = vi.fn();
      const migrate = vi.fn();
      await runVercelBuild(environment, { build, migrate });
      expect(build).toHaveBeenCalledOnce();
      expect(migrate).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "", "prod"])(
    "refuses an unknown environment (%s) before running either stage",
    async (environment) => {
      const build = vi.fn();
      const migrate = vi.fn();
      await expect(
        runVercelBuild(environment, { build, migrate }),
      ).rejects.toThrow("VERCEL_ENV");
      expect(build).not.toHaveBeenCalled();
      expect(migrate).not.toHaveBeenCalled();
    },
  );
});
