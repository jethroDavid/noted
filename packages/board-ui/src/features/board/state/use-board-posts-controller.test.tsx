// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError, type NotedApiClient } from "@noted/api-client";
import type {
  BoardPost,
  BoardPostsResponse,
  CreatePostInput,
  UpdatePostContentInput,
  UpdatePostPositionInput,
} from "@noted/contracts";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomesAuth } from "../../homes/homes-auth";
import { boardPostsKey } from "./posts-keys";
import { makeBoardPostsQueryClient } from "./posts-query-client";
import { useBoardPostsController } from "./use-board-posts-controller";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => cleanup());

const homeId = "home-1";
const boardId = "board-1";

function makePost(overrides?: Partial<BoardPost>): BoardPost {
  return {
    id: "post-1",
    boardId,
    kind: "text",
    text: "Oat milk",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:05:00.000Z",
    deletionRequestedAt: null,
    deleteAfter: null,
    ...overrides,
  };
}

function makeBoard(overrides?: {
  posts?: BoardPost[];
  serverTime?: string;
}): BoardPostsResponse {
  return {
    board: {
      id: boardId,
      homeId,
    },
    posts: overrides?.posts ?? [makePost()],
    serverTime: overrides?.serverTime ?? "2026-09-21T11:30:00.000Z",
  };
}

function makeApi() {
  let board = makeBoard();
  const api = {
    me: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    homes: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    createHome: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    home: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    renameHome: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    invite: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    removeMember: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    leaveHome: vi.fn(async (): Promise<never> => {
      throw new Error("unused");
    }),
    boardPosts: vi.fn(async (): Promise<BoardPostsResponse> => board),
    createPost: vi.fn(
      async (
        _homeId: string,
        _boardId: string,
        input: CreatePostInput,
      ): Promise<{ post: BoardPost }> => ({
        post: makePost({ id: "post-new", ...input }),
      }),
    ),
    editPost: vi.fn(
      async (
        _homeId: string,
        postId: string,
        input: UpdatePostContentInput,
      ): Promise<{ post: BoardPost }> => ({
        post: makePost({ id: postId, ...input }),
      }),
    ),
    movePost: vi.fn(
      async (
        _homeId: string,
        postId: string,
        input: UpdatePostPositionInput,
      ): Promise<{ post: BoardPost }> => ({
        post: makePost({ id: postId, ...input }),
      }),
    ),
    requestRemoval: vi.fn(
      async (
        _homeId: string,
        postId: string,
      ): Promise<{ post: BoardPost }> => ({
        post: makePost({
          id: postId,
          deletionRequestedAt: "2026-09-21T11:00:00.000Z",
          deleteAfter: "2026-09-21T12:00:00.000Z",
        }),
      }),
    ),
    undoRemoval: vi.fn(
      async (
        _homeId: string,
        postId: string,
      ): Promise<{ post: BoardPost }> => ({
        post: makePost({ id: postId }),
      }),
    ),
  } satisfies NotedApiClient;
  return {
    api,
    setBoard(next: BoardPostsResponse) {
      board = next;
    },
  };
}

function makeAuth() {
  let accountId: string | undefined = "account-1";
  let onAccountChanged: ((id: string | undefined) => void) | null = null;
  const auth: HomesAuth = {
    isConfigured: () => true,
    getAccountId: () => accountId,
    subscribe: (changed) => {
      onAccountChanged = changed;
      return () => {
        onAccountChanged = null;
      };
    },
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      accountId = undefined;
    }),
    errorMessage: (cause: unknown) =>
      cause instanceof Error ? cause.message : "Authentication failed.",
  };
  return {
    auth,
    emit(id: string | undefined) {
      act(() => {
        accountId = id;
        onAccountChanged?.(id);
      });
    },
  };
}

function renderController() {
  const queryClient = makeBoardPostsQueryClient();
  const api = makeApi();
  const fake = makeAuth();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook(
    () => useBoardPostsController(api.api, fake.auth, homeId, boardId),
    { wrapper },
  );
  return { ...rendered, api, auth: fake, queryClient };
}

async function renderReady() {
  const harness = renderController();
  harness.auth.emit("account-1");
  await waitFor(() => expect(harness.result.current.mode).toBe("ready"));
  return harness;
}

describe("board-posts controller", () => {
  it("loads the board once the account resolves", async () => {
    const rendered = renderController();
    expect(rendered.result.current.mode).toBe("loading");
    expect(rendered.api.api.boardPosts).not.toHaveBeenCalled();
    rendered.auth.emit("account-1");
    await waitFor(() => expect(rendered.result.current.mode).toBe("ready"));
    expect(
      rendered.result.current.board?.posts.map((post) => post.text),
    ).toEqual(["Oat milk"]);
    const serverTime = Date.parse("2026-09-21T11:30:00.000Z");
    expect(
      Math.abs(rendered.result.current.serverNow() - serverTime),
    ).toBeLessThan(5000);
  });

  it("writes created posts into the cache without refetching", async () => {
    const rendered = await renderReady();
    const saved = await act(async () =>
      rendered.result.current.createPost({
        text: "Strawberries",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
        x: 0.6,
        y: 0.7,
      }),
    );
    expect(saved?.text).toBe("Strawberries");
    await waitFor(() =>
      expect(rendered.result.current.board?.posts).toHaveLength(2),
    );
    expect(rendered.api.api.boardPosts).toHaveBeenCalledTimes(1);
  });

  it("surfaces a removal conflict and keeps the cached post", async () => {
    const rendered = await renderReady();
    rendered.api.api.editPost.mockRejectedValueOnce(
      new ApiError(409, "This post is greyed out for removal."),
    );
    const saved = await act(async () =>
      rendered.result.current.editPost("post-1", {
        text: "changed while grey",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
      }),
    );
    expect(saved).toBeNull();
    await waitFor(() =>
      expect(rendered.result.current.error).toBe(
        "This post is greyed out for removal.",
      ),
    );
    expect(rendered.result.current.board?.posts[0].text).toBe("Oat milk");
  });

  it("clears the previous account entries on account change", async () => {
    const rendered = await renderReady();
    rendered.api.setBoard(
      makeBoard({ posts: [makePost({ id: "post-2", text: "Hello" })] }),
    );
    rendered.auth.emit("account-2");
    await waitFor(() =>
      expect(
        rendered.result.current.board?.posts.map((post) => post.text),
      ).toEqual(["Hello"]),
    );
    expect(
      rendered.queryClient.getQueryData(
        boardPostsKey("account-1", homeId, boardId),
      ),
    ).toBeUndefined();
    expect(rendered.api.api.boardPosts).toHaveBeenCalledTimes(2);
  });

  it("reports lost access instead of showing stale posts", async () => {
    const rendered = renderController();
    rendered.api.api.boardPosts.mockRejectedValue(
      new ApiError(404, "Home not found."),
    );
    rendered.auth.emit("account-1");
    await waitFor(() => expect(rendered.result.current.accessLost).toBe(true));
    expect(rendered.result.current.board).toBeNull();
  });

  it("writes removal and Undo into the cached post", async () => {
    const rendered = await renderReady();
    await act(async () => {
      expect(await rendered.result.current.requestRemoval("post-1")).toBe(true);
    });
    await waitFor(() =>
      expect(rendered.result.current.board?.posts[0].deleteAfter).toBe(
        "2026-09-21T12:00:00.000Z",
      ),
    );
    await act(async () => {
      expect(await rendered.result.current.undoRemoval("post-1")).toBe(true);
    });
    await waitFor(() =>
      expect(rendered.result.current.board?.posts[0].deleteAfter).toBeNull(),
    );
  });
});
