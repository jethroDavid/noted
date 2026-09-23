import { QueryClient } from "@tanstack/react-query";

/**
 * One client per HomesProvider, created once in component state. Never
 * module-level: separate providers own separate caches, and server rendering
 * must not share query state between requests.
 */
export function makeHomesQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Loads fail fast into error mode with a manual retry(); no hidden retries.
        retry: false,
        // Mutations write their response straight into the cache, so freshly
        // written data must count as fresh: opening the route for a home that
        // was just written must not refetch and clobber the response.
        staleTime: 15_000,
        // Mutations write their response straight into the cache, so a query
        // that already has data must not refetch just because it remounted.
        refetchOnMount: false,
        // Visibility changes and reconnects revalidate even when data is
        // fresh, like the previous refresh hook. Window focus events are
        // bridged explicitly in the controller: TanStack only listens for
        // visibility changes, not focus events.
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        // 15s polls replace the previous refresh timer.
        refetchInterval: 15_000,
      },
    },
  });
}
