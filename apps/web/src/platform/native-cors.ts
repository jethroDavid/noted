import "server-only";

const nativeOrigins = new Set([
  "https://localhost",
  "capacitor://localhost",
  "noted://app",
]);

export function nativeCorsHeaders(origin: string | null): Headers {
  const headers = new Headers({ Vary: "Origin" });
  const developmentOrigin =
    process.env.NODE_ENV !== "production" &&
    origin !== null &&
    /^http:\/\/localhost(?::\d+)?$/.test(origin);
  if (origin && (nativeOrigins.has(origin) || developmentOrigin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, trpc-accept",
    );
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}
