import { boundaryConfig } from "@noted/eslint-config/boundaries";
import nextjsConfig from "@noted/eslint-config/nextjs";

export default [
  ...nextjsConfig,
  boundaryConfig("explicit"),
  boundaryConfig("server", ["src/app/**/route.ts", "src/app/**/layout.tsx"]),
  boundaryConfig("client", [
    "src/features/**/*.{ts,tsx}",
    "src/platform/auth/**/*.{ts,tsx}",
    "src/trpc/**/*.{ts,tsx}",
  ]),
];
