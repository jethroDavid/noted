"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { NotedApiClient } from "@noted/api-client";
import type { HomesAuth } from "../../homes/homes-auth";
import { FridgePostsContext } from "./fridge-posts-context";
import { makeFridgePostsQueryClient } from "./posts-query-client";
import { useFridgePostsController } from "./use-fridge-posts-controller";

export function FridgePostsProvider({
  api,
  auth,
  homeId,
  boardId,
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  homeId: string;
  boardId: string;
  children?: ReactNode;
}) {
  const [queryClient] = useState(() => makeFridgePostsQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <FridgePostsControllerHost
        api={api}
        auth={auth}
        homeId={homeId}
        boardId={boardId}
      >
        {children}
      </FridgePostsControllerHost>
    </QueryClientProvider>
  );
}

function FridgePostsControllerHost({
  api,
  auth,
  homeId,
  boardId,
  children,
}: {
  api: NotedApiClient;
  auth: HomesAuth;
  homeId: string;
  boardId: string;
  children?: ReactNode;
}) {
  const posts = useFridgePostsController(api, auth, homeId, boardId);
  return <FridgePostsContext value={posts}>{children}</FridgePostsContext>;
}
