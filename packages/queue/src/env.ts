import "server-only";

interface QueueEnvBase {
  currentSigningKey: string | null;
  nextSigningKey: string | null;
}

export type QueueEnv =
  | (QueueEnvBase & {
      mode: "qstash";
      qstashToken: string;
      appUrl: string;
    })
  | (QueueEnvBase & {
      mode: "dev";
      workerBaseUrl: string;
    });

// Only QSTASH_TOKEN selects the cloud path: with a token, jobs publish to
// QStash for delivery at APP_URL; without one, the QStash dev server
// delivers to the local worker routes (same SDK, same signatures).
export function queueEnv(): QueueEnv {
  const base: QueueEnvBase = {
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? null,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? null,
  };
  const qstashToken = process.env.QSTASH_TOKEN ?? null;
  if (!qstashToken) {
    const port = process.env.PORT ?? 3000;
    return {
      ...base,
      mode: "dev",
      workerBaseUrl: process.env.WORKER_BASE_URL ?? `http://localhost:${port}`,
    };
  }
  // Deploy misconfiguration fails fast and loud at first publish, never
  // as a silently dropped job.
  const appUrl = process.env.APP_URL ?? null;
  if (!appUrl) {
    throw new Error("QSTASH_TOKEN is set but APP_URL is missing.");
  }
  return { ...base, mode: "qstash", qstashToken, appUrl };
}
