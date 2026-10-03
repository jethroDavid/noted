import type { Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queueEnv } from "./env";
import { jobEnvelopeSchema } from "./jobs";
import { publishJob } from "./publish";
import { verifyWorkerRequest } from "./verify";

// Queue tests run against the real QStash dev server (spawned by the SDK
// on first use, port 8080): publishing and signature verification go
// through the actual vendor code path, with delivery captured by a stub
// HTTP server. Only this file publishes, so no two tests race the spawn.
type ManagedKey =
  | "QSTASH_TOKEN"
  | "APP_URL"
  | "WORKER_BASE_URL"
  | "PORT"
  | "QSTASH_CURRENT_SIGNING_KEY"
  | "QSTASH_NEXT_SIGNING_KEY";

const savedEnv = new Map<string, string | undefined>();

function setEnv(key: ManagedKey, value?: string) {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

// zod's uuid enforces version and variant bits (only the nil and max
// UUIDs are exempt), so fixtures use real v4-shaped ids.
const HOME_ID = "123e4567-e89b-12d3-a456-426614174000";
const ASSET_ID = "123e4567-e89b-42d3-a456-426614174999";

describe("job envelopes", () => {
  it("accepts all job shapes", () => {
    expect(
      jobEnvelopeSchema.safeParse({
        job: "process-media",
        homeId: HOME_ID,
        assetId: ASSET_ID,
      }).success,
    ).toBe(true);
    expect(
      jobEnvelopeSchema.safeParse({
        job: "cleanup-media",
        homeId: HOME_ID,
        assetId: ASSET_ID,
        keys: ["homes/x/originals/y.jpg"],
      }).success,
    ).toBe(true);
    expect(jobEnvelopeSchema.safeParse({ job: "sweep-reels" }).success).toBe(
      true,
    );
  });

  it("rejects unknown jobs and empty cleanups", () => {
    expect(jobEnvelopeSchema.safeParse({ job: "launch-rockets" }).success).toBe(
      false,
    );
    expect(
      jobEnvelopeSchema.safeParse({
        job: "cleanup-media",
        homeId: "not-a-uuid",
        assetId: ASSET_ID,
        keys: [],
      }).success,
    ).toBe(false);
  });
});

describe("queue env", () => {
  it("selects dev mode without a token", () => {
    setEnv("QSTASH_TOKEN");
    const env = queueEnv();
    expect(env.mode).toBe("dev");
    if (env.mode === "dev") {
      expect(env.workerBaseUrl).toContain("http://localhost:");
    }
  });

  it("fails fast when a token has no app URL", () => {
    setEnv("QSTASH_TOKEN", "bogus");
    setEnv("APP_URL");
    expect(() => queueEnv()).toThrow(
      "QSTASH_TOKEN is set but APP_URL is missing.",
    );
  });
});

describe("worker verification", () => {
  it("rejects a forged signature against cloud keys", async () => {
    setEnv("QSTASH_CURRENT_SIGNING_KEY", "bogus-current-key");
    setEnv("QSTASH_NEXT_SIGNING_KEY");
    const verification = await verifyWorkerRequest(
      new Request("http://localhost/api/workers/process-media", {
        method: "POST",
        headers: { "upstash-signature": "forged" },
        body: JSON.stringify({ job: "process-media" }),
      }),
    );
    expect(verification.ok).toBe(false);
  });

  it("refuses unsigned calls in production without keys", async () => {
    setEnv("QSTASH_CURRENT_SIGNING_KEY");
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const verification = await verifyWorkerRequest(
        new Request("http://localhost/api/workers/process-media", {
          method: "POST",
          body: JSON.stringify({ job: "process-media" }),
        }),
      );
      expect(verification.ok).toBe(false);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("delivers a signed job through the dev server", async () => {
    setEnv("QSTASH_TOKEN");
    setEnv("QSTASH_CURRENT_SIGNING_KEY");
    setEnv("QSTASH_NEXT_SIGNING_KEY");
    const received: Array<{ signature: string | null; body: string }> = [];
    const stub: Server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
      });
      req.on("end", () => {
        const signature = req.headers["upstash-signature"];
        received.push({
          signature: typeof signature === "string" ? signature : null,
          body,
        });
        res.statusCode = 200;
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => stub.listen(0, resolve));
    const { port } = stub.address() as AddressInfo;
    setEnv("WORKER_BASE_URL", `http://localhost:${port}`);
    try {
      const outcome = await publishJob({
        job: "process-media",
        homeId: HOME_ID,
        assetId: ASSET_ID,
      });
      expect(outcome).toEqual({ delivered: true, via: "dev" });
      // Delivery is async: the dev server signs and POSTs behind the call.
      await vi.waitFor(() => expect(received).toHaveLength(1), {
        timeout: 30_000,
      });
      const [delivery] = received;
      const verification = await verifyWorkerRequest(
        new Request(`http://localhost:${port}/api/workers/process-media`, {
          method: "POST",
          headers: delivery.signature
            ? { "upstash-signature": delivery.signature }
            : {},
          body: delivery.body,
        }),
      );
      expect(verification.ok).toBe(true);
      expect(
        jobEnvelopeSchema.safeParse(JSON.parse(verification.body)).success,
      ).toBe(true);
    } finally {
      stub.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        stub.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }, 60_000);
});
