// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError, type NotedApiClient } from "@noted/api-client";
import type { HomeDetail, MeResponse } from "@noted/contracts";
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

function renderController() {
  const queryClient = makeHomesQueryClient();
  const api = makeApi();
  const fake = makeAuth();
  const onSignedOut = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook(
    () => useHomesController(api, fake.auth, onSignedOut),
    { wrapper },
  );
  return { ...rendered, queryClient, api, fake, onSignedOut };
}

async function renderReady() {
  const harness = renderController();
  harness.fake.emit("account-1");
  await waitFor(() => expect(harness.result.current.mode).toBe("ready"));
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

  it("select opens the home and merges it into the switcher list", async () => {
    const harness = await renderReady();
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.home.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.selectHome("home-a");
    });
    expect(harness.result.current.busy).toBe(true);
    expect(harness.result.current.openingHomeId).toBe("home-a");

    const renamed = { ...homeA, name: "The Sunday home (renamed)" };
    await act(async () => {
      gate.resolve({ home: renamed });
      await saved;
    });
    expect(await saved).toBe(true);
    expect(harness.result.current.home).toEqual(renamed);
    expect(harness.result.current.me?.homes).toEqual([renamed]);
    expect(harness.result.current.busy).toBe(false);
    expect(harness.result.current.openingHomeId).toBeNull();
  });

  it("create opens the new home and lists it once", async () => {
    const harness = await renderReady();
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.createHome("Our kitchen");
    });
    expect(saved).toBe(true);
    expect(harness.result.current.home?.name).toBe("Our kitchen");
    expect(harness.result.current.me?.homes.map((home) => home.name)).toEqual([
      "The Sunday home",
      "Our kitchen",
    ]);
  });

  it("rename updates the fridge and switcher together without duplicating", async () => {
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
    const meCalls = harness.api.me.mock.calls.length;
    let saved = false;
    await act(async () => {
      saved = await harness.result.current.leaveHome("home-a");
    });
    expect(saved).toBe(true);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.me?.homes).toEqual([homeB]);
    expect(harness.api.me.mock.calls.length).toBe(meCalls);
  });

  it("a failed operation reports its message and preserves the open home", async () => {
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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
  });

  it("overlapping selects resolve once and the latest wins", async () => {
    const harness = await renderReady();
    const first = deferred<{ home: HomeDetail }>();
    const second = deferred<{ home: HomeDetail }>();
    harness.api.home
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let firstSaved!: Promise<boolean>;
    let secondSaved!: Promise<boolean>;
    act(() => {
      firstSaved = harness.result.current.selectHome("home-a");
    });
    act(() => {
      secondSaved = harness.result.current.selectHome("home-b");
    });
    expect(harness.result.current.openingHomeId).toBe("home-b");
    expect(harness.result.current.busy).toBe(true);

    await act(async () => {
      first.resolve({ home: homeA });
      await firstSaved;
    });
    expect(await firstSaved).toBe(false);
    expect(harness.result.current.home).toBeNull();
    await act(async () => {
      second.resolve({ home: homeB });
      await secondSaved;
    });
    expect(await secondSaved).toBe(true);
    expect(harness.result.current.home).toEqual(homeB);
    expect(harness.result.current.busy).toBe(false);
    expect(harness.result.current.openingHomeId).toBeNull();
  });

  it("backToHomes drops a late select result", async () => {
    const harness = await renderReady();
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.home.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.selectHome("home-a");
    });
    act(() => harness.result.current.backToHomes());
    await act(async () => {
      gate.resolve({ home: homeA });
      await saved;
    });
    expect(await saved).toBe(false);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.result.current.openingHomeId).toBeNull();
  });

  it("an account switch never flashes the previous account", async () => {
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
    const gate = deferred<MeResponse>();
    harness.api.me.mockReturnValueOnce(gate.promise);
    harness.fake.emit("account-2");
    expect(harness.result.current.mode).toBe("loading");
    expect(harness.result.current.me).toBeNull();
    expect(harness.result.current.home).toBeNull();

    await act(async () => {
      gate.resolve(meAccount2);
      await gate.promise;
    });
    await waitFor(() => expect(harness.result.current.me).toEqual(meAccount2));
    expect(harness.result.current.mode).toBe("ready");
    expect(harness.result.current.home).toBeNull();
  });

  it("mutation results from an old account are dropped", async () => {
    const harness = await renderReady();
    const gate = deferred<{ home: HomeDetail }>();
    harness.api.home.mockReturnValueOnce(gate.promise);
    let saved!: Promise<boolean>;
    act(() => {
      saved = harness.result.current.selectHome("home-a");
    });
    harness.api.me.mockResolvedValueOnce(meAccount2);
    harness.fake.emit("account-2");
    await waitFor(() => expect(harness.result.current.me).toEqual(meAccount2));
    await act(async () => {
      gate.resolve({ home: homeA });
      await saved;
    });
    expect(await saved).toBe(false);
    expect(harness.result.current.home).toBeNull();
    expect(harness.result.current.me).toEqual(meAccount2);
  });

  it("a sign-out event clears private data and pending UI", async () => {
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
    harness.fake.emit(undefined);
    expect(harness.result.current).toMatchObject({
      mode: "signed-out",
      me: null,
      home: null,
      busy: false,
      openingHomeId: null,
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
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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
    const harness = await renderReady();
    await act(async () => {
      await harness.result.current.selectHome("home-a");
    });
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

    await act(async () => {
      await harness.result.current.createHome("A fresh start");
    });
    expect(harness.result.current.error).toBeNull();
    expect(harness.result.current.home?.name).toBe("A fresh start");
  });
});
