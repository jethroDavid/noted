// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError, type NotedApiClient } from "@noted/api-client";
import type {
  BoardPost,
  BoardPostsResponse,
  HomeDetail,
  MeResponse,
} from "@noted/contracts";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomesAuth } from "./homes-auth";
import { makeHomesQueryClient } from "./homes-query-client";
import { useHomesController } from "./use-homes-controller";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => cleanup());

const homeA: HomeDetail = {
  id: "home-a",
  name: "The Sunday home",
  boardId: "board-a",
  creatorUserId: "user-1",
  role: "creator",
  members: [],
  pendingInvitations: [],
};
const homeB: HomeDetail = {
  id: "home-b",
  name: "The little apartment",
  boardId: "board-b",
  creatorUserId: "user-1",
  role: "creator",
  members: [],
  pendingInvitations: [],
};
const meAccount1: MeResponse = {
  user: { id: "user-1", email: "alex@example.test", displayName: "Alex" },
  homes: [homeA],
};
const meAccount2: MeResponse = {
  user: { id: "user-2", email: "sam@example.test", displayName: "Sam" },
  homes: [homeB],
};

const postFixture: BoardPost = {
  id: "post-1",
  boardId: "board-a",
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
};
const boardFixture: BoardPostsResponse = {
  board: { id: "board-a", homeId: "home-a", postAdditions: 1 },
  posts: [postFixture],
  serverTime: "2026-09-21T11:30:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeApi() {
  return {
    me: vi.fn(async (): Promise<MeResponse> => meAccount1),
    homes: vi.fn(async () => ({ homes: [] })),
    createHome: vi.fn(async (name: string) => ({
      home: { ...homeA, id: "home-new", name },
    })),
    home: vi.fn(async (id: string) => ({
      home: id === homeB.id ? homeB : homeA,
    })),
    renameHome: vi.fn(async (id: string, name: string) => ({
      home: { ...homeA, id, name },
    })),
    invite: vi.fn(async (id: string) => ({ home: { ...homeA, id } })),
    removeMember: vi.fn(async (id: string) => ({ home: { ...homeA, id } })),
    leaveHome: vi.fn(async () => ({ homes: [homeB] })),
    boardPosts: vi.fn(async (): Promise<BoardPostsResponse> => boardFixture),
    createPost: vi.fn(async (): Promise<{ post: BoardPost }> => ({
      post: postFixture,
    })),
    editPost: vi.fn(async (): Promise<{ post: BoardPost }> => ({
      post: postFixture,
    })),
    movePost: vi.fn(async (): Promise<{ post: BoardPost }> => ({
      post: postFixture,
    })),
    requestRemoval: vi.fn(async (): Promise<{ post: BoardPost }> => ({
      post: postFixture,
    })),
    undoRemoval: vi.fn(async (): Promise<{ post: BoardPost }> => ({
      post: postFixture,
    })),
  } satisfies NotedApiClient;
}

function makeAuth() {
  let accountId: string | undefined = "account-1";
  let onAccountChanged: ((id: string | undefined) => void) | null = null;
  let onError: ((cause: unknown) => void) | null = null;
  const auth: HomesAuth = {
    isConfigured: () => true,
    getAccountId: () => accountId,
    subscribe: (changed, failed) => {
      onAccountChanged = changed;
      onError = failed;
      return () => {
        onAccountChanged = null;
        onError = null;
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
    fail(cause: unknown) {
      act(() => {
        onError?.(cause);
      });
    },
  };
}

function renderController(initialHomeId: string | null = null) {
  const queryClient = makeHomesQueryClient();
  const api = makeApi();
  const fake = makeAuth();
  const onSignedOut = vi.fn();
  const onOpenHome = vi.fn();
  const onBackToHomes = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook(
    ({ homeId }: { homeId: string | null }) =>
      useHomesController(api, fake.auth, onSignedOut, {
        homeId,
        onOpenHome,
        onBackToHomes,
      }),
    { wrapper, initialProps: { homeId: initialHomeId } },
  );
  return {
    ...rendered,
    queryClient,
    api,
    fake,
    onSignedOut,
    onOpenHome,
    onBackToHomes,
    setHomeId(id: string | null) {
      rendered.rerender({ homeId: id });
    },
  };
}

async function renderReady(homeId: string | null = null) {
  const harness = renderController(homeId);
  harness.fake.emit("account-1");
  await waitFor(() => expect(harness.result.current.mode).toBe("ready"));
  return harness;
}

async function renderOpenHome(homeId = "home-a") {
  const harness = await renderReady(homeId);
  await waitFor(() => expect(harness.result.current.home?.id).toBe(homeId));
  return harness;
}

describe("homes controller", () => {
  it("loads the profile once the account resolves", async () => {
    const harness = renderController();
    expect(harness.result.current.mode).toBe("loading");
    expect(harness.api.me).not.toHaveBeenCalled();
    harness.fake.emit("account-1");
    await waitFor(() => expect(harness.result.current.me).toEqual(meAccount1));
    expect(harness.result.current).toMatchObject({
      mode: "ready",
      home: null,
      busy: false,
      error: null,
    });
    expect(harness.api.me).toHaveBeenCalledTimes(1);
  });

  it("an unconfigured shell stays in setup and never subscribes", () => {
    const queryClient = makeHomesQueryClient();
    const api = makeApi();
    const fake = makeAuth();
    const subscribe = vi.fn(fake.auth.subscribe);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () =>
        useHomesController(api, {
          ...fake.auth,
          isConfigured: () => false,
          subscribe,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("setup");
    expect(subscribe).not.toHaveBeenCalled();
    expect(api.me).not.toHaveBeenCalled();
  });

  it("a failed initial load can retry without signing in again", async () => {
    const harness = renderController();
    harness.api.me.mockRejectedValueOnce(
      new ApiError(503, "Temporarily unavailable"),
    );
    harness.fake.emit("account-1");
    await waitFor(() => expect(harness.result.current.mode).toBe("error"));
    expect(harness.result.current.error).toBe("Temporarily unavailable");
    expect(harness.result.current.me).toBeNull();

    act(() => harness.result.current.retry());
    await waitFor(() => expect(harness.result.current.mode).toBe("ready"));
    expect(harness.result.current.me).toEqual(meAccount1);
    expect(harness.result.current.error).toBeNull();
  });

  it("an unauthorized initial load signs out with the server message", async () => {
    const harness = renderController();
    harness.api.me.mockRejectedValueOnce(new ApiError(401, "Session expired."));
    harness.fake.emit("account-1");
    await waitFor(() => expect(harness.result.current.mode).toBe("signed-out"));
    expect(harness.result.current.error).toBe("Session expired.");
    expect(harness.result.current.me).toBeNull();
  });

  it("select navigates to the home route without fetching", async () => {
    const harness = await renderReady();
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.selectHome("home-a");
    });
    expect(saved).toBe(true);
    expect(harness.onOpenHome).toHaveBeenCalledTimes(1);
    expect(harness.onOpenHome).toHaveBeenCalledWith("home-a");
    expect(harness.api.home).not.toHaveBeenCalled();
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.busy).toBe(false);
  });

  it("a route id loads its home from the server", async () => {
    const harness = await renderReady();
    expect(harness.result.current.home).toBeNull();
    expect(harness.api.home).not.toHaveBeenCalled();
    harness.setHomeId("home-b");
    await waitFor(() => expect(harness.result.current.home).toEqual(homeB));
    expect(harness.api.home).toHaveBeenCalledWith("home-b");
  });

  it("create lists the new home once and navigates to it", async () => {
    const harness = await renderReady();
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.createHome("Our kitchen");
    });
    expect(saved).toBe(true);
    expect(harness.onOpenHome).toHaveBeenCalledWith("home-new");
    expect(harness.result.current.me?.homes.map((home) => home.name)).toEqual([
      "The Sunday home",
      "Our kitchen",
    ]);
    // Navigation lands: the new id loads from the written cache, not the server.
    harness.setHomeId("home-new");
    await waitFor(() =>
      expect(harness.result.current.home?.name).toBe("Our kitchen"),
    );
    expect(harness.api.home).not.toHaveBeenCalled();
  });

  it("rename updates the fridge and switcher together without duplicating", async () => {
    const harness = await renderOpenHome("home-a");
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.renameHome("home-a", "Our kitchen");
    });
    expect(saved).toBe(true);
    expect(harness.result.current.home?.name).toBe("Our kitchen");
    expect(harness.result.current.me?.homes).toHaveLength(1);
    expect(harness.result.current.me?.homes[0].name).toBe("Our kitchen");
  });

  it("invite and remove write the returned home", async () => {
    const harness = await renderOpenHome("home-a");
    const invited = {
      ...homeA,
      pendingInvitations: [
        {
          id: "invite-1",
          email: "pat@example.test",
          createdAt: new Date(0).toISOString(),
        },
      ],
    };
    harness.api.invite.mockResolvedValueOnce({ home: invited });
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.inviteMember(
        "home-a",
        "pat@example.test",
      );
    });
    expect(saved).toBe(true);
    expect(harness.result.current.home?.pendingInvitations).toHaveLength(1);

    const removed = {
      ...invited,
      members: [
        {
          id: "user-1",
          email: "alex@example.test",
          displayName: "Alex",
          isCreator: true,
        },
      ],
    };
    harness.api.removeMember.mockResolvedValueOnce({ home: removed });
    await act(async () => {
      saved = await harness.result.current.removeMember("home-a", "user-2");
    });
    expect(saved).toBe(true);
    expect(harness.result.current.home?.members).toHaveLength(1);
  });

  it("leave closes the home and keeps the remaining list without refetching", async () => {
    const harness = await renderOpenHome("home-a");
    const meCalls = harness.api.me.mock.calls.length;
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.leaveHome("home-a");
    });
    expect(saved).toBe(true);
    expect(harness.onBackToHomes).toHaveBeenCalledTimes(1);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.me?.homes).toEqual([homeB]);
    expect(harness.api.me.mock.calls.length).toBe(meCalls);
  });

  it("a failed operation reports its message and preserves the open home", async () => {
    const harness = await renderOpenHome("home-a");
    harness.api.renameHome.mockRejectedValueOnce(
      new ApiError(503, "Please retry the name change."),
    );
    let saved = true;
    await act(async () => {
      saved = await harness.result.current.renameHome("home-a", "Our kitchen");
    });
    expect(saved).toBe(false);
    expect(harness.result.current.error).toBe("Please retry the name change.");
    expect(harness.result.current.home?.name).toBe("The Sunday home");
    expect(harness.result.current.busy).toBe(false);

    await act(async () => {
      saved = await harness.result.current.renameHome("home-a", "Our kitchen");
    });
    expect(saved).toBe(true);
    expect(harness.result.current.error).toBeNull();
    expect(harness.result.current.home?.name).toBe("Our kitchen");
  });

  it("an expired session during an edit signs out without navigating", async () => {
    const harness = await renderOpenHome("home-a");
    harness.api.renameHome.mockRejectedValueOnce(
      new ApiError(401, "Session expired."),
    );
    let saved = true;
    await act(async () => {
      saved = await harness.result.current.renameHome("home-a", "Our kitchen");
    });
    expect(saved).toBe(false);
    expect(harness.result.current.mode).toBe("signed-out");
    expect(harness.result.current.error).toBe(
      "Your sign-in expired. Please sign in again.",
    );
    expect(harness.result.current.me).toBeNull();
    expect(harness.result.current.home).toBeNull();
    expect(harness.onSignedOut).not.toHaveBeenCalled();
    expect(harness.onBackToHomes).not.toHaveBeenCalled();
  });

  it("a home change drops a late rename result", async () => {
    const harness = await renderOpenHome("home-a");
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.renameHome.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.renameHome("home-a", "Our kitchen");
    });
    expect(harness.result.current.busy).toBe(true);
    harness.setHomeId("home-b");
    await act(async () => {
      gate.resolve({ home: { ...homeA, name: "Our kitchen" } });
      await saved;
    });
    expect(await saved).toBe(false);
    expect(harness.result.current.error).toBeNull();
    await waitFor(() => expect(harness.result.current.busy).toBe(false));
    await waitFor(() => expect(harness.result.current.home).toEqual(homeB));
  });

  it("backToHomes drops a late rename result and navigates", async () => {
    const harness = await renderOpenHome("home-a");
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.renameHome.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.renameHome("home-a", "Our kitchen");
    });
    act(() => harness.result.current.backToHomes());
    expect(harness.onBackToHomes).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve({ home: { ...homeA, name: "Our kitchen" } });
      await saved;
    });
    expect(await saved).toBe(false);
    expect(harness.result.current.error).toBeNull();
    harness.setHomeId(null);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.mode).toBe("ready");
  });

  it("an account switch never flashes the previous account", async () => {
    const harness = await renderOpenHome("home-a");
    const gate = deferred<MeResponse>();
    harness.api.me.mockReturnValueOnce(gate.promise);
    harness.api.home.mockRejectedValueOnce(
      new ApiError(404, "Home not found."),
    );
    harness.fake.emit("account-2");
    expect(harness.result.current.mode).toBe("loading");
    expect(harness.result.current.me).toBeNull();
    expect(harness.result.current.home).toBeNull();

    await act(async () => {
      gate.resolve(meAccount2);
      await gate.promise;
    });
    await waitFor(() => expect(harness.result.current.me).toEqual(meAccount2));
    await waitFor(() => expect(harness.onBackToHomes).toHaveBeenCalledTimes(1));
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.error).toBe(
      "You no longer have access to that home.",
    );
  });

  it("mutation results from an old account are dropped", async () => {
    const harness = await renderOpenHome("home-a");
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.renameHome.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.renameHome("home-a", "Our kitchen");
    });
    harness.api.me.mockResolvedValueOnce(meAccount2);
    harness.api.home.mockRejectedValueOnce(
      new ApiError(404, "Home not found."),
    );
    harness.fake.emit("account-2");
    await waitFor(() => expect(harness.result.current.me).toEqual(meAccount2));
    await act(async () => {
      gate.resolve({ home: { ...homeA, name: "Our kitchen" } });
      await saved;
    });
    expect(await saved).toBe(false);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.me).toEqual(meAccount2);
  });

  it("a sign-out event clears private data and pending UI", async () => {
    const harness = await renderOpenHome("home-a");
    harness.fake.emit(undefined);
    expect(harness.result.current).toMatchObject({
      mode: "signed-out",
      me: null,
      home: null,
      busy: false,
      error: null,
    });
  });

  it("same-account re-sign-in reloads after expiry", async () => {
    const harness = await renderReady();
    harness.api.me.mockRejectedValueOnce(new ApiError(401, "Expired."));
    await act(async () => {
      await harness.queryClient.invalidateQueries({
        queryKey: ["homes", "me", "account-1"],
      });
    });
    await waitFor(() => expect(harness.result.current.mode).toBe("signed-out"));
    harness.api.me.mockResolvedValueOnce(meAccount1);
    await act(async () => {
      await harness.result.current.signIn();
    });
    await waitFor(() => expect(harness.result.current.mode).toBe("ready"));
    expect(harness.result.current.me).toEqual(meAccount1);
    expect(harness.fake.auth.signIn).toHaveBeenCalledTimes(1);
  });

  it("a failed sign-in surfaces the adapter message", async () => {
    const harness = await renderReady();
    harness.fake.emit(undefined);
    expect(harness.result.current.mode).toBe("signed-out");
    vi.mocked(harness.fake.auth.signIn).mockRejectedValueOnce(
      new Error("Popup closed."),
    );
    await act(async () => {
      await harness.result.current.signIn();
    });
    expect(harness.result.current.error).toBe("Popup closed.");
    expect(harness.result.current.busy).toBe(false);
  });

  it("sign-out failures keep the session and report once", async () => {
    const harness = await renderReady();
    vi.mocked(harness.fake.auth.signOut).mockRejectedValueOnce(
      new Error("Network down."),
    );
    await act(async () => {
      await harness.result.current.signOut();
    });
    expect(harness.result.current.error).toBe(
      "We couldn't sign you out. Please try again.",
    );
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.onSignedOut).not.toHaveBeenCalled();
  });

  it("sign-out navigates once the account is gone", async () => {
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.signOut();
    });
    expect(harness.onSignedOut).toHaveBeenCalledTimes(1);
    expect(harness.result.current.busy).toBe(false);
  });

  it("an auth subscription failure signs out with the adapter message", async () => {
    const harness = await renderReady();
    harness.fake.fail(new Error("Token revoked."));
    expect(harness.result.current.mode).toBe("signed-out");
    expect(harness.result.current.error).toBe("Token revoked.");
    expect(harness.result.current.me).toBeNull();
  });

  it("retry without an account resets to signed-out", async () => {
    const harness = await renderReady();
    harness.fake.emit(undefined);
    act(() => harness.result.current.retry());
    expect(harness.result.current.mode).toBe("signed-out");
    expect(harness.result.current.error).toBeNull();
  });

  it("a background failure keeps the fridge open behind a banner", async () => {
    const harness = await renderOpenHome("home-a");
    harness.api.me.mockRejectedValueOnce(new ApiError(503, "Unavailable"));
    await act(async () => {
      await harness.queryClient.invalidateQueries({
        queryKey: ["homes", "me", "account-1"],
      });
    });
    await waitFor(() =>
      expect(harness.result.current.error).toBe(
        "Couldn't refresh your homes. We'll try again when you reconnect.",
      ),
    );
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.result.current.home).toEqual(homeA);

    await act(async () => {
      await harness.queryClient.invalidateQueries({
        queryKey: ["homes", "me", "account-1"],
      });
    });
    await waitFor(() => expect(harness.result.current.error).toBeNull());
  });

  it("revoked membership closes the home once and prunes the list", async () => {
    const harness = await renderOpenHome("home-a");
    harness.api.home.mockRejectedValueOnce(
      new ApiError(404, "Home not found."),
    );
    await act(async () => {
      await harness.queryClient.invalidateQueries({
        queryKey: ["homes", "home", "account-1", "home-a"],
      });
    });
    await waitFor(() => expect(harness.result.current.home).toBeNull());
    expect(harness.result.current.me?.homes).toEqual([]);
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.result.current.error).toBe(
      "You no longer have access to that home.",
    );
    expect(harness.onBackToHomes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await harness.result.current.createHome("A fresh start");
    });
    expect(harness.onOpenHome).toHaveBeenCalledWith("home-new");
    expect(harness.result.current.error).toBeNull();
    const homeCalls = harness.api.home.mock.calls.length;
    harness.setHomeId("home-new");
    await waitFor(() =>
      expect(harness.result.current.home?.name).toBe("A fresh start"),
    );
    expect(harness.api.home.mock.calls.length).toBe(homeCalls);
  });
});
