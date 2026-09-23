"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type NotedApiClient } from "@noted/api-client";
import type {
  BoardPost,
  BoardPostsResponse,
  CreatePostInput,
  UpdatePostContentInput,
  UpdatePostPositionInput,
} from "@noted/contracts";
import { useEffect, useRef, useState } from "react";
import type { HomesAuth } from "../../homes/homes-auth";
import { boardPostsKey, fridgePostsPrefix } from "./posts-keys";

export type FridgePostsMode = "loading" | "ready" | "error";

/**
 * Decides whether a settled operation still belongs to this view. The account
 * comparison drops results that arrive after a switch; the generation drops
 * results that arrive after a newer operation, retry, or navigation.
 */
type OperationStamp = { generation: number; accountId: string | undefined };

function messageOf(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function isUnauthorized(cause: unknown) {
  return cause instanceof ApiError && cause.status === 401;
}

function isAccessLost(cause: unknown) {
  return (
    cause instanceof ApiError && (cause.status === 403 || cause.status === 404)
  );
}

/** One instance per FridgePostsProvider. Components consume it through useFridgePosts(). */
export function useFridgePostsController(
  api: NotedApiClient,
  auth: HomesAuth,
  homeId: string,
  boardId: string,
) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [accountResolved, setAccountResolved] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const generationRef = useRef(0);
  const serverOffsetRef = useRef(0);

  const queriesEnabled = accountResolved && accountId !== undefined;
  // The query function deliberately ignores the abort signal (even reading it
  // marks it consumed): leaving a view must not cancel its in-flight request.
  const boardQuery = useQuery({
    queryKey: boardPostsKey(accountId, homeId, boardId),
    queryFn: () => loadBoard(),
    enabled: queriesEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePostInput) =>
      api.createPost(homeId, boardId, input),
  });
  const editMutation = useMutation({
    mutationFn: ({
      postId,
      input,
    }: {
      postId: string;
      input: UpdatePostContentInput;
    }) => api.editPost(homeId, postId, input),
  });
  const moveMutation = useMutation({
    mutationFn: ({
      postId,
      input,
    }: {
      postId: string;
      input: UpdatePostPositionInput;
    }) => api.movePost(homeId, postId, input),
  });
  const removeMutation = useMutation({
    mutationFn: (postId: string) => api.requestRemoval(homeId, postId),
  });
  const undoMutation = useMutation({
    mutationFn: (postId: string) => api.undoRemoval(homeId, postId),
  });

  function handleLostAccess(account: string) {
    queryClient.removeQueries({
      queryKey: boardPostsKey(account, homeId, boardId),
    });
    setAccessLost(true);
    setOperationError(null);
  }

  async function loadBoard() {
    try {
      const board = await api.boardPosts(homeId, boardId);
      serverOffsetRef.current = Date.parse(board.serverTime) - Date.now();
      setAccessLost(false);
      return board;
    } catch (cause) {
      if (isAccessLost(cause)) {
        // No cache removal here: dropping the active query from its own
        // fetch would recreate and refetch it immediately. The errored
        // query simply carries no data until access returns.
        setAccessLost(true);
        setOperationError(null);
      }
      throw cause;
    }
  }

  useEffect(() => {
    function resetClientState() {
      generationRef.current++;
      setAccessLost(false);
      setOperationError(null);
    }

    function accountChanged(nextAccountId: string | undefined) {
      resetClientState();
      queryClient.removeQueries({ queryKey: fridgePostsPrefix });
      setAccountId(nextAccountId);
      setAccountResolved(true);
    }

    function accountFailed(cause: unknown) {
      resetClientState();
      queryClient.removeQueries({ queryKey: fridgePostsPrefix });
      setOperationError(auth.errorMessage(cause));
      setAccountId(undefined);
      setAccountResolved(true);
    }

    const unsubscribe = auth.subscribe(accountChanged, accountFailed);
    return unsubscribe;
  }, [auth, queryClient]);

  useEffect(() => {
    // TanStack reacts to visibility changes, not window focus events, so
    // bridge those explicitly. Disabled queries are skipped by refetchQueries.
    function refetchOnFocus() {
      void queryClient.refetchQueries({
        queryKey: fridgePostsPrefix,
        type: "active",
      });
    }
    window.addEventListener("focus", refetchOnFocus);
    return () => window.removeEventListener("focus", refetchOnFocus);
  }, [queryClient]);

  let mode: FridgePostsMode = "ready";
  if (!accountResolved) {
    mode = "loading";
  } else if (boardQuery.isPending) {
    mode = "loading";
  } else if (boardQuery.isError && boardQuery.data == null && !accessLost) {
    mode = "error";
  }

  const refreshError =
    mode === "ready" &&
    boardQuery.isError &&
    !isUnauthorized(boardQuery.error) &&
    !accessLost
      ? "Couldn't refresh the fridge. We'll try again when you reconnect."
      : null;
  let error: string | null = null;
  if (mode === "error") {
    error = messageOf(boardQuery.error, "The fridge couldn't load.");
  } else if (mode === "ready") {
    error = operationError ?? refreshError;
  }

  const board = mode === "ready" ? (boardQuery.data ?? null) : null;

  const busy =
    createMutation.isPending ||
    editMutation.isPending ||
    moveMutation.isPending ||
    removeMutation.isPending ||
    undoMutation.isPending;

  function serverNow() {
    return Date.now() + serverOffsetRef.current;
  }

  function beginOperation(): OperationStamp {
    generationRef.current++;
    setOperationError(null);
    return {
      generation: generationRef.current,
      accountId: auth.getAccountId(),
    };
  }

  function appliesToView(stamp: OperationStamp) {
    return (
      stamp.generation === generationRef.current &&
      stamp.accountId === auth.getAccountId()
    );
  }

  function reportFailure(stamp: OperationStamp, cause: unknown) {
    if (!appliesToView(stamp)) return;
    if (isAccessLost(cause) && stamp.accountId !== undefined) {
      handleLostAccess(stamp.accountId);
      return;
    }
    if (isUnauthorized(cause)) {
      setOperationError("Your sign-in expired. Please sign in again.");
      return;
    }
    setOperationError(messageOf(cause, "Something went wrong. Try again."));
  }

  function writePostToCache(
    account: string | undefined,
    saved: BoardPost,
    created: boolean,
  ) {
    queryClient.setQueryData<BoardPostsResponse | undefined>(
      boardPostsKey(account, homeId, boardId),
      (old) =>
        old && {
          ...old,
          posts: old.posts.some((item) => item.id === saved.id)
            ? old.posts.map((item) => (item.id === saved.id ? saved : item))
            : [...old.posts, saved],
          // Only creates change the additions count; polls correct any drift.
          board: created
            ? {
                ...old.board,
                postAdditions: old.board.postAdditions + 1,
              }
            : old.board,
        },
    );
  }

  // Create and edit return the saved post so the caller can select it and
  // close its modal; other operations return whether their result applied.
  async function createPost(input: CreatePostInput): Promise<BoardPost | null> {
    const stamp = beginOperation();
    try {
      const { post } = await createMutation.mutateAsync(input);
      if (!appliesToView(stamp)) return null;
      writePostToCache(stamp.accountId, post, true);
      return post;
    } catch (cause) {
      reportFailure(stamp, cause);
      return null;
    }
  }

  async function editPost(
    postId: string,
    input: UpdatePostContentInput,
  ): Promise<BoardPost | null> {
    const stamp = beginOperation();
    try {
      const { post } = await editMutation.mutateAsync({ postId, input });
      if (!appliesToView(stamp)) return null;
      writePostToCache(stamp.accountId, post, false);
      return post;
    } catch (cause) {
      reportFailure(stamp, cause);
      return null;
    }
  }

  async function movePost(
    postId: string,
    input: UpdatePostPositionInput,
  ): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { post } = await moveMutation.mutateAsync({ postId, input });
      if (!appliesToView(stamp)) return false;
      writePostToCache(stamp.accountId, post, false);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function requestRemoval(postId: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { post } = await removeMutation.mutateAsync(postId);
      if (!appliesToView(stamp)) return false;
      writePostToCache(stamp.accountId, post, false);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function undoRemoval(postId: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { post } = await undoMutation.mutateAsync(postId);
      if (!appliesToView(stamp)) return false;
      writePostToCache(stamp.accountId, post, false);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  function retry() {
    generationRef.current++;
    setAccessLost(false);
    setOperationError(null);
    if (auth.getAccountId()) {
      void queryClient.invalidateQueries({ queryKey: fridgePostsPrefix });
    } else {
      queryClient.removeQueries({ queryKey: fridgePostsPrefix });
    }
  }

  return {
    mode,
    board,
    busy,
    accessLost,
    error,
    retry,
    serverNow,
    createPost,
    editPost,
    movePost,
    requestRemoval,
    undoRemoval,
  };
}

export type FridgePostsController = ReturnType<typeof useFridgePostsController>;
