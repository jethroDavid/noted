import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import firebasePublic from "./firebase-public.json" with { type: "json" };

// Shells share build wiring, never server environment objects. Only this
// explicit public allowlist is embedded in an installed native application.
export function nativeBuildConfig(outDir: string) {
  return defineConfig(({ mode }) => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const env = { ...loadEnv(mode, root, ""), ...process.env };
    const apiUrl =
      mode === "development"
        ? (env.NATIVE_API_URL ?? "http://localhost:3000")
        : (env.NATIVE_RELEASE_API_URL ?? "https://noted-six-chi.vercel.app");
    return {
      base: "./",
      publicDir: `${root}/apps/web/public`,
      plugins: [
        tailwindcss(),
        {
          name: "noted-native-manifest",
          generateBundle() {
            this.emitFile({
              type: "asset",
              fileName: "native-config.json",
              source: JSON.stringify({ apiUrl }),
            });
          },
        },
      ],
      define: {
        __NOTED_CONFIG__: JSON.stringify({
          apiUrl,
          powersyncUrl:
            mode === "development"
              ? env.POWERSYNC_URL
              : env.NATIVE_RELEASE_POWERSYNC_URL,
          firebase: {
            apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || firebasePublic.apiKey,
            authDomain:
              env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebasePublic.authDomain,
            projectId:
              env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebasePublic.projectId,
            appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || firebasePublic.appId,
          },
        }),
      },
      optimizeDeps: { exclude: ["@journeyapps/wa-sqlite", "@powersync/web"] },
      worker: { format: "es" as const },
      build: { outDir, emptyOutDir: true },
    };
  });
}
