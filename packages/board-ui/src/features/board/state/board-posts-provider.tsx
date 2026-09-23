"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { NotedApiClient } from "@noted/api-client";
import type { HomesAuth } from "../../homes/homes-auth";
import { BoardPostsContext } from "./board-posts-context";
import { makeBoardPostsQueryClient } from "./posts-query-client";
import { useBoardPostsController } from "./use-board-posts-controller";

export function BoardPostsProvider({
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
  const [queryClient] = useState(() => makeBoardPostsQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <BoardPostsControllerHost
        api={api}
        auth={auth}
        homeId={homeId}
        boardId={boardId}
      >
        {children}
      </BoardPostsControllerHost>
    </QueryClientProvider>
  );
}

function BoardPostsControllerHost({
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
  const posts = useBoardPostsController(api, auth, homeId, boardId);
  return <BoardPostsContext value={posts}>{children}</BoardPostsContext>;
}
