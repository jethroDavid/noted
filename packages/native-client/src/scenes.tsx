"use client";

import type { AppRouter } from "@noted/api/src";
import {
  AuthContext,
  HomeScene,
  MembersPanel,
  OfflineContentContext,
  TRPCProvider,
} from "@noted/experience/src";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { Auth } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSceneClient } from "./scene-client";
import { nativeApi } from "./session";
import type { NativeSession } from "./session";

const contentRouters: readonly (keyof inferRouterOutputs<AppRouter>)[] = [
  "boards",
  "homes",
  "media",
];

export function NativeScenes({
  session,
  auth,
  apiUrl,
  homeId,
  onBack,
}: {
  session: NativeSession;
  auth: Auth;
  apiUrl: string;
  homeId: string;
  onBack(): void;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { networkMode: "always", retry: false },
          mutations: { networkMode: "always", retry: false },
        },
      }),
  );
  const [managementQueries] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const root = useRef<HTMLDivElement>(null);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const [status, setStatus] = useState(session.database.currentStatus);
  const [pending, setPending] = useState(0);
  const [transferFailures, setTransferFailures] = useState(0);
  const [outcomes, setOutcomes] = useState(0);
  const [boardId, setBoardId] = useState<string>();
  const month = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth() - archiveOffset,
      1,
    ),
  )
    .toISOString()
    .slice(0, 7);
  const viewSynced =
    status.forStream({
      name: "home_media",
      parameters: { home_id: homeId, month },
    })?.subscription.hasSynced &&
    boardId &&
    status.forStream({ name: "board_notes", parameters: { board_id: boardId } })
      ?.subscription.hasSynced;
  useEffect(
    () => session.database.registerListener({ statusChanged: setStatus }),
    [session],
  );
  const client = useMemo(
    () =>
      createSceneClient(session, apiUrl, () => auth.currentUser!.getIdToken()),
    [session, apiUrl, auth],
  );
  const remote = useMemo(
    () => nativeApi(apiUrl, () => auth.currentUser!.getIdToken()),
    [apiUrl, auth],
  );
  const content = useMemo(
    () => ({
      savePhoto: session.attachments.save,
      saveVideo: session.attachments.save,
      online: status.connected,
      retrySync: session.retrySync,
      statusLabel: transferFailures
        ? "Media sync paused. Saved on this device."
        : outcomes
          ? "Changes need attention"
          : pending
            ? "Changes pending sync"
            : status.uploadError || status.downloadError
              ? "Sync paused"
              : status.connected
                ? viewSynced && !status.downloading
                  ? "Synced"
                  : "Syncing"
                : "Saved on this device",
      loadOlderMemories: () => setArchiveOffset((offset) => offset + 1),
    }),
    [session, status, pending, outcomes, viewSynced, transferFailures],
  );
  useEffect(() => {
    const abort = new AbortController();
    let pin:
      | Awaited<
          ReturnType<
            ReturnType<typeof session.database.syncStream>["subscribe"]
          >
        >
      | undefined;
    let notesPin: typeof pin;
    void session.database
      .syncStream("home_media", {
        home_id: homeId,
        month,
      })
      .subscribe({ ttl: 604800 })
      .then((result) => {
        if (abort.signal.aborted) result.unsubscribe();
        else pin = result;
      })
      .catch(() => {});
    void session.database
      .get<{ id: string }>("SELECT id FROM boards WHERE home_id=?", [homeId])
      .then(async (board) => {
        if (abort.signal.aborted) return;
        setBoardId(board.id);
        const result = await session.database
          .syncStream("board_notes", { board_id: board.id })
          .subscribe({ ttl: 604800 });
        if (abort.signal.aborted) result.unsubscribe();
        else notesPin = result;
      })
      .catch(() => {});
    let dirty = false;
    const invalidate = () =>
      queryClient.invalidateQueries({
        predicate: (query) => {
          const path = query.queryKey[0];
          return (
            Array.isArray(path) &&
            contentRouters.some((router) => router === String(path[0]))
          );
        },
      });
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe(() => {
        if (dirty && !queryClient.isMutating()) {
          dirty = false;
          void invalidate();
        }
      });
    const tables = [
      "posts",
      "media_assets",
      "reels",
      "book_entries",
      "attachments",
      "homes",
      "revoked_homes",
      "note_pending",
      "note_outcomes",
      "note_revisions",
      "media_failures",
    ];
    void (async () => {
      for await (const _ of session.database.watch(
        tables
          .map((table) => `SELECT '${table}' AS source,id FROM ${table}`)
          .join(" UNION ALL "),
        [],
        { signal: abort.signal },
      )) {
        // A mutation owns its optimistic view until the local transaction resolves.
        if (queryClient.isMutating()) dirty = true;
        else await invalidate();
        const count =
          (
            await session.database.get<{ count: number }>(
              "SELECT count(*) AS count FROM note_pending",
            )
          ).count + (await session.attachments.pending());
        const attention = (
          await session.database.get<{ count: number }>(
            "SELECT count(*) AS count FROM note_outcomes",
          )
        ).count;
        if (!abort.signal.aborted) {
          setTransferFailures(
            (
              await session.database.get<{ count: number }>(
                "SELECT count(*) AS count FROM media_failures",
              )
            ).count,
          );
          setPending(count);
          setOutcomes(attention);
        }
      }
    })().catch(() => {});
    return () => {
      abort.abort();
      unsubscribeMutations();
      pin?.unsubscribe();
      notesPin?.unsubscribe();
      queryClient.clear();
      managementQueries.clear();
    };
  }, [session, homeId, queryClient, managementQueries, month]);
  useEffect(() => {
    const surface = root.current;
    if (!surface) return;
    const observed = new Set<Element>();
    const visibleNodes = new Map<string, Set<Element>>();
    const reported = new Map<string, boolean>();
    const decorative = (node: Element) => {
      const hidden = node.closest('[aria-hidden="true"]');
      // A modal may hide the application above this root. Only decorative
      // copies inside this scene are excluded; an open original stays pinned.
      return hidden !== null && surface.contains(hidden);
    };
    const update = (node: Element, visible: boolean) => {
      const asset = (node as HTMLElement).dataset.nativeAsset;
      if (!asset) return;
      const nodes = visibleNodes.get(asset) ?? new Set<Element>();
      if (visible) nodes.add(node);
      else nodes.delete(node);
      visibleNodes.set(asset, nodes);
      const next = nodes.size > 0,
        previous = reported.get(asset);
      if (previous === next || (previous === undefined && !next)) return;
      reported.set(asset, next);
      void session.attachments.view(asset, next).catch(() => {});
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          update(
            entry.target,
            entry.target.isConnected &&
              !decorative(entry.target) &&
              entry.isIntersecting &&
              entry.intersectionRatio > 0,
          );
      },
      { threshold: 0.1 },
    );
    const scan = () => {
      for (const node of surface.querySelectorAll("[data-native-asset]"))
        if (!decorative(node) && !observed.has(node)) {
          observed.add(node);
          observer.observe(node);
        }
      for (const node of observed)
        if (!node.isConnected || decorative(node)) {
          update(node, false);
          observer.unobserve(node);
          observed.delete(node);
        }
    };
    const mutations = new MutationObserver(scan);
    mutations.observe(surface, { childList: true, subtree: true });
    scan();
    return () => {
      mutations.disconnect();
      observer.disconnect();
      for (const [asset, visible] of reported) {
        if (visible)
          void session.attachments.view(asset, false).catch(() => {});
      }
    };
  }, [session]);
  return (
    <AuthContext.Provider
      value={{
        status: "signed-in",
        user: auth.currentUser!,
        error: null,
        signIn: async () => {},
        signOut: async () => {
          onBack();
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TRPCProvider queryClient={queryClient} trpcClient={client}>
          <OfflineContentContext.Provider value={content}>
            <div ref={root}>
              <HomeScene
                homeId={homeId}
                onBack={onBack}
                renderMembers={(onClose) => (
                  <QueryClientProvider client={managementQueries}>
                    <TRPCProvider
                      queryClient={managementQueries}
                      trpcClient={remote}
                    >
                      <MembersPanel
                        homeId={homeId}
                        onClose={onClose}
                        onLeave={onBack}
                      />
                    </TRPCProvider>
                  </QueryClientProvider>
                )}
              />
            </div>
          </OfflineContentContext.Provider>
        </TRPCProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
