import "server-only";
import { createHash } from "node:crypto";
import { Client } from "@upstash/qstash";
import { queueEnv } from "./env";
import { WORKER_ROUTES } from "./jobs";

export async function ensureWorkerSchedules() {
  const env = queueEnv();
  if (env.mode !== "qstash") {
    console.log("Cloud worker schedules skipped: local queue mode.");
    return;
  }
  const client = new Client({ token: env.qstashToken, enableTelemetry: false });
  const scope = createHash("sha256")
    .update(env.appUrl)
    .digest("hex")
    .slice(0, 12);
  for (const [job, cron] of [
    ["reconcile-media", "*/5 * * * *"],
    ["sweep-reels", "0 3 * * *"],
  ] as const) {
    await client.schedules.create({
      destination: `${env.appUrl}${WORKER_ROUTES[job]}`,
      cron,
      scheduleId: `noted-${scope}-${job}`,
      body: JSON.stringify({ job }),
      headers: { "content-type": "application/json" },
    });
  }
}
