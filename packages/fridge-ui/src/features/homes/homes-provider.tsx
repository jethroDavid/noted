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
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  onSignedOut?: () => void;
  children?: ReactNode;
}) {
  const [queryClient] = useState(() => makeHomesQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <HomesControllerHost api={api} auth={auth} onSignedOut={onSignedOut}>
        {children}
      </HomesControllerHost>
    </QueryClientProvider>
  );
}

function HomesControllerHost({
  api,
  auth,
  onSignedOut,
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  onSignedOut?: () => void;
  children?: ReactNode;
}) {
  const homes = useHomesController(api, auth, onSignedOut);
  return <HomesContext value={homes}>{children}</HomesContext>;
}
