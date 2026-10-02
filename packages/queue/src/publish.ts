import "server-only";
import { Client } from "@upstash/qstash";
import { queueEnv } from "./env";
import { WORKER_ROUTES } from "./jobs";
import type { JobEnvelope } from "./jobs";

export interface PublishOutcome {
  delivered: boolean;
  via: "qstash" | "dev";
}

// Jobs are fire-and-forget and fail-open: a lost process job leaves the
// original visible (variants fall back to it); a lost cleanup job leaves
// orphan blobs. Every loss is logged — never silent success.
export async function publishJob(
  envelope: JobEnvelope,
): Promise<PublishOutcome> {
  // Config errors throw (fail fast, outside the delivery try); delivery
  // failures degrade (fail open, inside it).
  const env = queueEnv();
  try {
    const client =
      env.mode === "qstash"
        ? new Client({ token: env.qstashToken, enableTelemetry: false })
        : new Client({ devMode: true, enableTelemetry: false });
    const baseUrl = env.mode === "qstash" ? env.appUrl : env.workerBaseUrl;
    await client.publishJSON({
      url: `${baseUrl}${WORKER_ROUTES[envelope.job]}`,
      body: envelope,
    });
    return { delivered: true, via: env.mode };
  } catch (error) {
    console.error(`Dropping ${envelope.job} job during queue outage:`, error);
    return { delivered: false, via: env.mode };
  }
}
