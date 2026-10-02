import "server-only";
import superjson from "superjson";
import { commands, createSubscriber } from "./redis";

export function boardChannel(boardId: string): string {
  return `board:${boardId}`;
}

export function homeChannel(homeId: string): string {
  return `home:${homeId}`;
}

// Events serialize with superjson so Dates in payloads round-trip.
// Fail-open: a Redis outage degrades to staleness (logged, recovered on
// the next reconnect) instead of failing the mutation that publishes.
async function publish(channel: string, event: unknown): Promise<void> {
  try {
    await commands.publish(channel, superjson.stringify(event));
  } catch (error) {
    console.error("Dropping event during Redis outage:", error);
  }
}

export async function publishBoardEvent(
  boardId: string,
  event: unknown,
): Promise<void> {
  await publish(boardChannel(boardId), event);
}

export async function publishHomeEvent(
  homeId: string,
  event: unknown,
): Promise<void> {
  await publish(homeChannel(homeId), event);
}

// Resolves once subscribed; the returned cleanup unsubscribes and releases
// the connection. Unparseable payloads are dropped, never fatal.
async function subscribe(
  channel: string,
  onEvent: (event: unknown) => void,
): Promise<() => Promise<void>> {
  const subscriber = createSubscriber();
  const onMessage = (_channel: string, payload: string) => {
    try {
      onEvent(superjson.parse(payload));
    } catch (error) {
      console.error("Dropping unparseable event:", error);
    }
  };

  subscriber.on("message", onMessage);
  await subscriber.subscribe(channel);

  return async () => {
    subscriber.off("message", onMessage);
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  };
}

export async function subscribeToBoard(
  boardId: string,
  onEvent: (event: unknown) => void,
): Promise<() => Promise<void>> {
  return subscribe(boardChannel(boardId), onEvent);
}

export async function subscribeToHome(
  homeId: string,
  onEvent: (event: unknown) => void,
): Promise<() => Promise<void>> {
  return subscribe(homeChannel(homeId), onEvent);
}
