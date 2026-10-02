"use client";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useTRPC } from "../../trpc/react";

// Home media events are invalidation signals like board events: every
// subscriber refetches on start, on data, and on terminal errors (a
// revoked member's refetch 404s into the "Home not found" screen).
export function useMediaEvents(homeId: string, onChanged: () => void) {
  const trpc = useTRPC();
  return useSubscription(
    trpc.media.onHomeEvent.subscriptionOptions(
      { homeId },
      {
        onStarted: () => onChanged(),
        onData: () => onChanged(),
        onError: () => onChanged(),
      },
    ),
  );
}
