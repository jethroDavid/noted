import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

const manifest = resolve("dist/native-config.json");
const apiUrl = existsSync(manifest)
  ? (JSON.parse(readFileSync(manifest, "utf8")) as { apiUrl: string }).apiUrl
  : "https://noted-six-chi.vercel.app";
const localDevelopment =
  new URL(apiUrl).protocol === "http:" &&
  new URL(apiUrl).hostname === "localhost";

// The installed application starts from bundled assets, including offline.
const config: CapacitorConfig = {
  appId: "com.noted.app",
  appName: "Noted",
  webDir: "dist",
  server: {
    cleartext: localDevelopment,
    hostname: "localhost",
    androidScheme: localDevelopment ? "http" : "https",
  },
  android: {
    allowMixedContent: localDevelopment,
  },
};

export default config;
