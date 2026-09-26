"use client";

import type { AppRouter } from "@noted/api/src";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";
import {
  isFirebaseConfigured,
  webAuth,
} from "../platform/auth/firebase-client";

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          // Firebase caches the token until near expiry, so per-request
          // resolution stays cheap while surviving token refreshes.
          headers: async () => {
            if (!isFirebaseConfigured()) return {};
            const token = await webAuth().currentUser?.getIdToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
