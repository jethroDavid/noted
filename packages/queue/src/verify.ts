import "server-only";
import { Receiver } from "@upstash/qstash";
import { queueEnv } from "./env";

export interface WorkerVerification {
  ok: boolean;
  body: string;
}

// Verification is real in every environment: cloud signing keys when
// configured, the dev server's deterministic keys otherwise. Production
// without keys refuses — an unsigned worker route must never exist there.
// The raw body is returned so the route can parse it after verifying.
export async function verifyWorkerRequest(
  req: Request,
): Promise<WorkerVerification> {
  const body = await req.text();
  const env = queueEnv();
  const signature = req.headers.get("upstash-signature") ?? "";
  try {
    if (env.currentSigningKey) {
      const receiver = new Receiver({
        currentSigningKey: env.currentSigningKey,
        nextSigningKey: env.nextSigningKey ?? env.currentSigningKey,
      });
      return { ok: await receiver.verify({ signature, body }), body };
    }
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Refusing worker call in production: QStash signing keys are not configured.",
      );
      return { ok: false, body };
    }
    const receiver = new Receiver({ devMode: true });
    return { ok: await receiver.verify({ signature, body }), body };
  } catch (error) {
    console.error("Worker signature verification failed:", error);
    return { ok: false, body };
  }
}
