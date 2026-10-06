import type { CapacitorConfig } from "@capacitor/cli";

// Thin wrapper: the app loads production in a native webview. All API and
// realtime traffic stays on plain HTTPS/SSE at {APP_URL}/api/trpc, so the
// existing tRPC links run untouched inside the webview.
const config: CapacitorConfig = {
  appId: "com.noted.app",
  appName: "Noted",
  webDir: "www",
  server: {
    url: "https://noted-six-chi.vercel.app",
    cleartext: false,
    // Firebase Google sign-in redirects through Google's OAuth pages; keep
    // those navigations inside the webview so the redirect returns to the app.
    allowNavigation: ["accounts.google.com", "*.firebaseapp.com"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
