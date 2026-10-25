"use client";

import { HomesScreen, TRPCProvider } from "@noted/experience/src";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Auth } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createSceneClient } from "./scene-client";
import type { NativeSession } from "./session";

export function NativeHomes({
  session,
  auth,
  apiUrl,
  onOpen,
  notice,
}: {
  session: NativeSession;
  auth: Auth;
  apiUrl: string;
  onOpen(id: string): void;
  notice: ReactNode;
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
  const client = useMemo(
    () =>
      createSceneClient(session, apiUrl, () => auth.currentUser!.getIdToken()),
    [session, apiUrl, auth],
  );
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      for await (const _ of session.database.watch(
        "SELECT h.id,h.name,h.creator_user_id,b.id AS board_id,p.id AS user_id,p.email,p.display_name FROM homes h JOIN boards b ON b.home_id=h.id LEFT JOIN account_profile p ON 1=1 WHERE NOT EXISTS (SELECT 1 FROM revoked_homes WHERE id=h.id)",
        [],
        { signal: abort.signal },
      )) {
        await queryClient.invalidateQueries();
      }
    })().catch(() => {});
    return () => {
      abort.abort();
      queryClient.clear();
    };
  }, [session, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={client}>
        <HomesScreen
          notice={notice}
          onNavigate={(href) => {
            const match = /^\/app\/homes\/([a-f0-9-]+)$/.exec(href);
            if (match?.[1]) onOpen(match[1]);
          }}
        />
      </TRPCProvider>
    </QueryClientProvider>
  );
}
