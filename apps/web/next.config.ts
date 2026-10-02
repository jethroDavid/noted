import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Single root .env for the monorepo (see README Setup). Missing files are
// ignored so platform-provided env (Vercel) keeps working; dotenv never
// overrides already-set variables.
loadEnv({ path: join(import.meta.dirname, "..", "..", ".env") });

const config: NextConfig = {
  reactStrictMode: true,
  // ffmpeg-static resolves its binary relative to its own module path at
  // runtime; bundling relocates the module and the exe lookup breaks
  // (ENOENT under a virtual path), so it stays external.
  serverExternalPackages: ["ffmpeg-static"],
  transpilePackages: [
    "@noted/api",
    "@noted/auth",
    "@noted/db",
    "@noted/domain",
    "@noted/media",
    "@noted/queue",
    "@noted/realtime",
    "@noted/ui",
    "@noted/validators",
  ],
};

export default config;
