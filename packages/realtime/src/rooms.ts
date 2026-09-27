import superjson from "superjson";
import { commands, createSubscriber } from "./redis";

export function boardChannel(boardId: string): string {
  return `board:${boardId}`;
}

// Events serialize with superjson so Dates in payloads round-trip.
// Fail-open: a Redis outage degrades to staleness (logged, recovered on
// the next reconnect) instead of failing the mutation that publishes.
export async function publishBoardEvent(
  boardId: string,
  event: unknown,
): Promise<void> {
  try {
    await commands.publish(boardChannel(boardId), superjson.stringify(event));
  } catch (error) {
    console.error("Dropping board event during Redis outage:", error);
  }
}

// Resolves once subscribed; the returned cleanup unsubscribes and releases
// the connection. Unparseable payloads are dropped, never fatal.
export async function subscribeToBoard(
  boardId: string,
  onEvent: (event: unknown) => void,
): Promise<() => Promise<void>> {
  const subscriber = createSubscriber();
  const onMessage = (_channel: string, payload: string) => {
    try {
      onEvent(superjson.parse(payload));
    } catch (error) {
      console.error("Dropping unparseable board event:", error);
    }
  };

  subscriber.on("message", onMessage);
  await subscriber.subscribe(boardChannel(boardId));

  return async () => {
    subscriber.off("message", onMessage);
    await subscriber.unsubscribe(boardChannel(boardId));
    await subscriber.quit();
  };
}
