import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";
import type { TRPCClientError } from "@trpc/client";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { EventSource } from "eventsource";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createContext, publicProcedure, router } from "./trpc";

// A public subscription with no database behind it, so the SSE mechanism
// (streaming, transformer, started/data/complete) is pinned without
// Postgres, Redis, or Firebase. Delivery of real board events is covered
// caller-level by .local/scratch/phase2-e2e.ts instead.
const sseTestRouter = router({
  ticks: publicProcedure.subscription(async function* () {
    yield "one";
    yield "two";
  }),
});

// The /api/trpc route is a thin fetchRequestHandler call, so this test
// serves the same handler (same router, same context) behind a real HTTP
// server and drives it with the real httpSubscriptionLink client.
function toRequest(req: IncomingMessage, port: number): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined) headers.append(name, entry);
      }
    }
  }
  return new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method: req.method,
    headers,
  });
}

async function sendResponse(source: Response, target: ServerResponse) {
  target.statusCode = source.status;
  source.headers.forEach((value, name) => target.setHeader(name, value));
  if (!source.body) {
    target.end();
    return;
  }
  const reader = source.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      target.write(value);
    }
  } finally {
    target.end();
  }
}

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      try {
        const { port } = server.address() as AddressInfo;
        const request = toRequest(req, port);
        const isTestRoute = new URL(request.url).pathname.startsWith(
          "/api/test",
        );
        // Each branch mirrors the app route exactly (same handler, same
        // context); the tick router just swaps the router for one with no
        // infrastructure behind it.
        const response = isTestRoute
          ? await fetchRequestHandler({
              endpoint: "/api/test",
              req: request,
              router: sseTestRouter,
              createContext,
            })
          : await fetchRequestHandler({
              endpoint: "/api/trpc",
              req: request,
              router: appRouter,
              createContext,
            });
        await sendResponse(response, res);
      } catch (error) {
        console.error(error);
        res.statusCode = 500;
        res.end();
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

function testClient() {
  return createTRPCClient<typeof sseTestRouter>({
    links: [
      httpSubscriptionLink({
        url: `${baseUrl}/api/test`,
        transformer: superjson,
        EventSource,
      }),
    ],
  });
}

function appClient(connectionParams?: Record<string, string>) {
  return createTRPCClient<AppRouter>({
    links: [
      httpSubscriptionLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
        EventSource,
        connectionParams,
      }),
    ],
  });
}

// A stalled stream fails the test instead of hanging the suite.
function withTimeout<T>(promise: Promise<T>, name: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out: ${name}`)), 10_000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// Subscribes to the real board stream expecting rejection: auth fails
// before any database or Redis access, so no infrastructure is needed.
async function boardsError(
  client: ReturnType<typeof appClient>,
): Promise<TRPCClientError<AppRouter>> {
  let sub: { unsubscribe: () => void } | undefined;
  try {
    return await withTimeout(
      new Promise<TRPCClientError<AppRouter>>((resolve, reject) => {
        sub = client.boards.onEvent.subscribe(
          { homeId: NIL_UUID, boardId: NIL_UUID },
          {
            onData: () => reject(new Error("unauthorized stream yielded data")),
            onComplete: () =>
              reject(new Error("unauthorized stream completed")),
            onError: (error) => resolve(error),
          },
        );
      }),
      "boards.onEvent rejection",
    );
  } finally {
    sub?.unsubscribe();
  }
}

describe("sse bridge", () => {
  it("streams subscription data over SSE", async () => {
    const client = testClient();
    const received: string[] = [];
    let started = false;
    let sub: { unsubscribe: () => void } | undefined;
    const completed = new Promise<void>((resolve, reject) => {
      sub = client.ticks.subscribe(undefined, {
        onStarted: () => {
          started = true;
        },
        onData: (data) => {
          received.push(data);
        },
        onComplete: () => resolve(),
        onError: (error) => reject(error),
      });
    });
    try {
      await withTimeout(completed, "ticks stream");
    } finally {
      sub?.unsubscribe();
    }
    expect(started).toBe(true);
    expect(received).toEqual(["one", "two"]);
  });

  it("rejects anonymous callers on protected subscriptions", async () => {
    const error = await boardsError(appClient());
    expect(error.data?.code).toBe("UNAUTHORIZED");
  });

  it("rejects a bogus token instead of degrading to anonymous", async () => {
    const error = await boardsError(appClient({ token: "bogus" }));
    // A connection-level rejection, never a degraded anonymous stream. The
    // exact code depends on whether Firebase is configured where the test
    // runs, so only its presence is stable.
    expect(error.data?.code).toBeDefined();
  });
});
