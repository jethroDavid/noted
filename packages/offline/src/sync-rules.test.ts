import { readFileSync } from "node:fs";
import { SqlSyncRules } from "@powersync/service-sync-rules";
import { expect, it } from "vitest";

it("compiles the deployed stream definition with PowerSync's SQL compiler", () => {
  const content = readFileSync(
    new URL("../../../powersync/sync-config.yaml", import.meta.url),
    "utf8",
  );
  expect(SqlSyncRules.validate(content, { defaultSchema: "public" })).toEqual(
    [],
  );
});
