// Packaged builds load the same production URL the mobile shell uses
// (see apps/mobile/capacitor.config.ts server.url): the window renders the
// deployed web app, so tRPC and SSE run untouched over same-origin HTTPS.
export const PRODUCTION_URL = "https://noted-six-chi.vercel.app";

export function resolveStartUrl(options: {
  packaged: boolean;
  appUrl?: string;
  port?: string;
}): string {
  if (!options.packaged) {
    if (options.appUrl) return options.appUrl;
    return `http://localhost:${options.port ?? "3000"}`;
  }
  return PRODUCTION_URL;
}
