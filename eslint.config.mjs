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
