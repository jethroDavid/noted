import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["packages/fridge-ui/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["packages/fridge-ui/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/**",
                "firebase",
                "firebase/**",
                "firebase-admin",
                "firebase-admin/**",
                "electron",
                "@capacitor/**",
                "@noted/server",
                "@noted/server/**",
                "@noted/database",
                "@noted/database/**",
                "@/**",
                "**/apps/**",
                "node:*",
              ],
              message:
                "Shared frontend features receive platform capabilities from their provider. Keep platform SDKs and backend code in the application shell.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/coverage/**",
    "test-results/**",
    "playwright-report/**",
    "**/dist/**",
    "**/node_modules/**",
    ".local/**",
    "packages/database/drizzle/**",
  ]),
]);
