import "server-only";
import { Redis } from "ioredis";

// Local compose default: tests and dev work with zero config while compose
// is up. CI and production set REDIS_URL explicitly (the Upstash TLS
// endpoint in production). ioredis speaks rediss:// with TLS on its own.
const url = process.env.REDIS_URL ?? "redis://localhost:6380";

function configure(client: Redis): Redis {
  // Without a listener, connection failures raise an unhandled 'error' and
  // crash the process. Log them; callers degrade (publishing is fail-open).
  client.on("error", (error) => {
    console.error("Redis error:", error);
  });
  return client;
}

function connect(): Redis {
  // Bounded retries keep a Redis outage from hanging mutations: commands
  // fail fast and the board degrades to staleness until reconnect.
  return configure(new Redis(url, { maxRetriesPerRequest: 3 }));
}

// Shared command connection (get/set/publish/presence). Never subscribes:
// a subscribed client cannot run other commands.
export const commands = connect();

// One subscriber per board subscription; the caller quits it on cleanup.
export function createSubscriber(): Redis {
  return connect();
}
