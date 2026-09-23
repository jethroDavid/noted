import { QueryClient } from "@tanstack/react-query";

/**
 * One client per BoardPostsProvider, created once in component state. Never
 * module-level: separate providers own separate caches, and server rendering
 * must not share query state between requests.
 */
export function makeBoardPostsQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Loads fail fast into error mode with a manual retry(); no hidden retries.
        retry: false,
        // Mutations write their response straight into the cache, so freshly
        // written data must count as fresh and must not refetch on remount.
        staleTime: 15_000,
        refetchOnMount: false,
        // Visibility changes and reconnects revalidate even when data is
        // fresh. Window focus events are bridged explicitly in the
        // controller: TanStack only listens for visibility changes.
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        // 5s polls keep the open board shared between members. Interval
        // polling pauses while the tab is hidden.
        refetchInterval: 5_000,
      },
    },
  });
}
