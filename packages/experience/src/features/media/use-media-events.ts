"use client";

import { skipToken } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useOfflineContent } from "../../runtime";
import { useTRPC } from "../../trpc/react";

// Home media events are invalidation signals like board events: every
// subscriber refetches on start, on data, and on terminal errors (a
// revoked member's refetch 404s into the "Home not found" screen).
export function useMediaEvents(homeId: string, onChanged: () => void) {
  const trpc = useTRPC();
  const offline = useOfflineContent();
  return useSubscription(
    trpc.media.onHomeEvent.subscriptionOptions(
      offline ? skipToken : { homeId },
      {
        onStarted: () => onChanged(),
        onData: () => onChanged(),
        onError: () => onChanged(),
      },
    ),
  );
}
