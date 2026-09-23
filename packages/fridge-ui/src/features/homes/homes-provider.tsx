"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { NotedApiClient } from "@noted/api-client";
import type { HomesAuth } from "./homes-auth";
import { HomesContext } from "./homes-context";
import { makeHomesQueryClient } from "./homes-query-client";
import { useHomesController } from "./use-homes-controller";

export function HomesProvider({
  api,
  auth,
  onSignedOut,
  homeId = null,
  onOpenHome,
  onBackToHomes,
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  onSignedOut?: () => void;
  homeId?: string | null;
  onOpenHome?: (id: string) => void;
  onBackToHomes?: () => void;
  children?: ReactNode;
}) {
  const [queryClient] = useState(() => makeHomesQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <HomesControllerHost
        api={api}
        auth={auth}
        onSignedOut={onSignedOut}
        homeId={homeId}
        onOpenHome={onOpenHome}
        onBackToHomes={onBackToHomes}
      >
        {children}
      </HomesControllerHost>
    </QueryClientProvider>
  );
}

function HomesControllerHost({
  api,
  auth,
  onSignedOut,
  homeId,
  onOpenHome,
  onBackToHomes,
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  onSignedOut?: () => void;
  homeId: string | null;
  onOpenHome?: (id: string) => void;
  onBackToHomes?: () => void;
  children?: ReactNode;
}) {
  const homes = useHomesController(api, auth, onSignedOut, {
    homeId,
    onOpenHome,
    onBackToHomes,
  });
  return <HomesContext value={homes}>{children}</HomesContext>;
}
