import "server-only";
import { handleSweepReels } from "@noted/api/src";
import { jobEnvelopeSchema, verifyWorkerRequest } from "@noted/queue/src";

// Thin by design: verify the QStash signature, parse the job envelope,
// run the api service. All logic lives in the service; this route never
// touches SQL, S3, or Redis directly. Invoked by a QStash Schedule (cron),
// not by a mutation-time publish like the other jobs.
export async function POST(req: Request) {
  const verification = await verifyWorkerRequest(req);
  if (!verification.ok) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(verification.body);
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const parsed = jobEnvelopeSchema.safeParse(payload);
  if (!parsed.success || parsed.data.job !== "sweep-reels") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  // The handler is idempotent (a re-run finds no rows), so a throw here
  // safely returns 500 for a QStash retry.
  await handleSweepReels(parsed.data);
  return Response.json({ ok: true });
}
