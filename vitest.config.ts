import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
    alias: {
      // Backend tests use the marker package's official no-op entry.
      "server-only": fileURLToPath(
        new URL("./empty.js", import.meta.resolve("server-only")),
      ),
    },
  },
});
