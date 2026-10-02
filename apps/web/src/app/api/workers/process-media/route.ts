import "server-only";
import { handleProcessMedia } from "@noted/api/src";
import { jobEnvelopeSchema, verifyWorkerRequest } from "@noted/queue/src";

// Thin by design: verify the QStash signature, parse the job envelope,
// run the api service. All logic lives in the service; this route never
// touches SQL, S3, or Redis directly.
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
  if (!parsed.success || parsed.data.job !== "process-media") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  // A throw here (transient S3 failure) returns 500, and QStash retries.
  // Permanent content failures are absorbed inside the handler instead.
  await handleProcessMedia(parsed.data);
  return Response.json({ ok: true });
}
