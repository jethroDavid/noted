"use client";

import type { AppRouter } from "@noted/api/src";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import superjson from "superjson";
import {
  isFirebaseConfigured,
  webAuth,
} from "../platform/auth/firebase-client";

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

// TanStack notifies subscribers on a setTimeout(0) by default, which lands
// after the browser paints: every optimistic update flashes its old state
// for a frame (drop a card, see it jump back, then land). Microtask
// notification keeps cache patches and the React updates made alongside
// them in the same frame.
notifyManager.setScheduler(queueMicrotask);

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Firebase caches the token until near expiry, so per-request resolution
// stays cheap while surviving token refreshes.
async function getAuthToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  return (await webAuth().currentUser?.getIdToken()) ?? null;
}

function createClient() {
  // Subscriptions ride SSE (EventSource) on the same /api/trpc route as
  // queries: plain HTTP streaming, no upgrade, no socket. EventSource GETs
  // cannot set headers, so the token rides as connection params (resolved
  // per connection, surviving refreshes and expiry); the server reads it
  // from info.connectionParams. EventSource reconnects natively, and each
  // reconnect re-runs the subscription, so onStarted refetches heal gaps.
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          connectionParams: async () => {
            const token = await getAuthToken();
            return token ? { token } : {};
          },
        }),
        false: httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          headers: async () => {
            const token = await getAuthToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      }),
    ],
  });
}

// Owns a tRPC client for the current Firebase account: the SSE stream
// authenticates with the token from subscribe time, so an account switch
// swaps in a fresh client (resubscribing included).
function useAccountScopedClient() {
  const [client, setClient] = useState(createClient);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = webAuth();
    // Baseline synchronously; the listener's immediate first fire with the
    // current user then reads as "no change".
    let lastUid = auth.currentUser?.uid ?? null;
    return onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      setClient(createClient());
    });
  }, []);

  return client;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const client = useAccountScopedClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={client}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
