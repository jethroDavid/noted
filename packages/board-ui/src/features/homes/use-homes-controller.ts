"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type NotedApiClient } from "@noted/api-client";
import type { HomeDetail, MeResponse } from "@noted/contracts";
import { useEffect, useRef, useState } from "react";
import type { HomesAuth } from "./homes-auth";
import { homeKey, homesPrefix, meKey } from "./homes-keys";

export type HomesMode = "loading" | "setup" | "signed-out" | "ready" | "error";

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

export type HomesNavigation = {
  /** Selected home id owned by the host shell (the route, on web). */
  homeId?: string | null;
  onOpenHome?: (id: string) => void;
  onBackToHomes?: () => void;
};

/** One instance per HomesProvider. Components consume it through useHomes(). */
export function useHomesController(
  api: NotedApiClient,
  auth: HomesAuth,
  onSignedOut?: () => void,
  navigation?: HomesNavigation,
) {
  const { homeId = null, onOpenHome, onBackToHomes } = navigation ?? {};
  const queryClient = useQueryClient();
  const configured = auth.isConfigured();
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [accountResolved, setAccountResolved] = useState(false);
  const [ignoredHomeId, setIgnoredHomeId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [signedOutError, setSignedOutError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const generationRef = useRef(0);
  const prevHomeIdRef = useRef(homeId);
  const keepErrorRef = useRef(false);

  // Selection belongs to the host shell. The controller only dismisses the
  // current id locally (leave, lost access) until navigation lands.
  const selectedHomeId =
    ignoredHomeId !== null && ignoredHomeId === homeId ? null : homeId;

  const queriesEnabled =
    configured && accountResolved && accountId !== undefined && !expired;
  // Query functions deliberately ignore the abort signal (even reading it
  // marks it consumed): leaving a view must not cancel its in-flight
  // request. Late responses land in the cache and are ignored unless their
  // view is still selected, exactly like the previous ticket guards.
  const meQuery = useQuery({
    queryKey: meKey(accountId),
    queryFn: () => loadProfile(),
    enabled: queriesEnabled,
  });
  const homeQuery = useQuery({
    queryKey: homeKey(accountId, selectedHomeId ?? undefined),
    queryFn: () => loadHome(),
    enabled: queriesEnabled && selectedHomeId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createHome(name),
  });
  const renameMutation = useMutation({
    mutationFn: ({ homeId, name }: { homeId: string; name: string }) =>
      api.renameHome(homeId, name),
  });
  const inviteMutation = useMutation({
    mutationFn: ({ homeId, email }: { homeId: string; email: string }) =>
      api.invite(homeId, email),
  });
  const removeMutation = useMutation({
    mutationFn: ({ homeId, memberId }: { homeId: string; memberId: string }) =>
      api.removeMember(homeId, memberId),
  });
  const leaveMutation = useMutation({
    mutationFn: (homeId: string) => api.leaveHome(homeId),
  });

  function handleUnauthorized(message: string) {
    generationRef.current++;
    setExpired(true);
    setSignedOutError(message);
    setOperationError(null);
    queryClient.removeQueries({ queryKey: homesPrefix });
  }

  function handleLostAccess(account: string, lostHomeId: string) {
    queryClient.setQueryData<MeResponse | undefined>(
      meKey(account),
      (old) =>
        old && {
          ...old,
          homes: old.homes.filter((home) => home.id !== lostHomeId),
        },
    );
    setIgnoredHomeId(lostHomeId);
    setOperationError("You no longer have access to that home.");
    keepErrorRef.current = true;
    onBackToHomes?.();
  }

  async function loadProfile() {
    try {
      return await api.me();
    } catch (cause) {
      if (isUnauthorized(cause)) {
        handleUnauthorized(
          queryClient.getQueryData(meKey(accountId)) == null
            ? messageOf(cause, "Your homes couldn't load.")
            : "Your sign-in expired. Please sign in again.",
        );
      }
      throw cause;
    }
  }

  async function loadHome() {
    const id = selectedHomeId ?? "";
    try {
      const { home } = await api.home(id);
      return home;
    } catch (cause) {
      if (
        isAccessLost(cause) &&
        selectedHomeId !== null &&
        accountId !== undefined
      ) {
        handleLostAccess(accountId, selectedHomeId);
      } else if (isUnauthorized(cause)) {
        handleUnauthorized("Your sign-in expired. Please sign in again.");
      }
      throw cause;
    }
  }

  useEffect(() => {
    if (!auth.isConfigured()) return;

    function resetClientState() {
      generationRef.current++;
      setExpired(false);
      setSignedOutError(null);
      setOperationError(null);
      setIgnoredHomeId(null);
      keepErrorRef.current = false;
    }

    function accountChanged(nextAccountId: string | undefined) {
      resetClientState();
      queryClient.removeQueries({ queryKey: homesPrefix });
      setAccountId(nextAccountId);
      setAccountResolved(true);
    }

    function accountFailed(cause: unknown) {
      resetClientState();
      queryClient.removeQueries({ queryKey: homesPrefix });
      setSignedOutError(auth.errorMessage(cause));
      setAccountId(undefined);
      setAccountResolved(true);
    }

    const unsubscribe = auth.subscribe(accountChanged, accountFailed);
    return unsubscribe;
  }, [auth, queryClient]);

  useEffect(() => {
    // Leaving a view (including browser back/forward) drops late results and
    // stale errors, exactly like navigating through backToHomes.
    if (prevHomeIdRef.current === homeId) return;
    prevHomeIdRef.current = homeId;
    generationRef.current++;
    setIgnoredHomeId(null);
    if (keepErrorRef.current) {
      keepErrorRef.current = false;
    } else {
      setOperationError(null);
    }
  }, [homeId]);

  useEffect(() => {
    // TanStack reacts to visibility changes, not window focus events, so
    // bridge those explicitly. Disabled queries (signed out, nothing
    // selected) are skipped by refetchQueries itself.
    function refetchOnFocus() {
      void queryClient.refetchQueries({
        queryKey: homesPrefix,
        type: "active",
      });
    }
    window.addEventListener("focus", refetchOnFocus);
    return () => window.removeEventListener("focus", refetchOnFocus);
  }, [queryClient]);

  const signedOut =
    accountId === undefined ||
    expired ||
    isUnauthorized(meQuery.error) ||
    isUnauthorized(homeQuery.error);
  let mode: HomesMode = "ready";
  if (!configured) {
    mode = "setup";
  } else if (!accountResolved) {
    mode = "loading";
  } else if (signedOut) {
    mode = "signed-out";
  } else if (meQuery.isPending) {
    mode = "loading";
  } else if (meQuery.isError && meQuery.data == null) {
    mode = "error";
  }

  const homeAccessLost =
    selectedHomeId !== null && isAccessLost(homeQuery.error);
  const refreshError =
    mode === "ready" &&
    ((meQuery.isError && !isUnauthorized(meQuery.error)) ||
      (selectedHomeId !== null &&
        homeQuery.isError &&
        !isUnauthorized(homeQuery.error) &&
        !homeAccessLost))
      ? "Couldn't refresh your homes. We'll try again when you reconnect."
      : null;
  let error: string | null = null;
  if (mode === "signed-out") {
    error = signedOutError ?? operationError;
  } else if (mode === "error") {
    error = messageOf(meQuery.error, "Your homes couldn't load.");
  } else if (mode === "ready") {
    error = operationError ?? refreshError;
  }

  const me = mode === "ready" ? (meQuery.data ?? null) : null;
  const home =
    mode === "ready" && selectedHomeId !== null
      ? (homeQuery.data ?? null)
      : null;
  const homeError =
    selectedHomeId !== null &&
    homeQuery.data == null &&
    homeQuery.isError &&
    !homeQuery.isFetching
      ? messageOf(homeQuery.error, "This home couldn't load.")
      : null;

  const busy =
    createMutation.isPending ||
    renameMutation.isPending ||
    inviteMutation.isPending ||
    removeMutation.isPending ||
    leaveMutation.isPending ||
    signInPending ||
    signOutPending;

  function beginOperation(): OperationStamp {
    generationRef.current++;
    setOperationError(null);
    setSignedOutError(null);
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
    if (isUnauthorized(cause)) {
      handleUnauthorized("Your sign-in expired. Please sign in again.");
      return;
    }
    setOperationError(messageOf(cause, "Something went wrong. Try again."));
  }

  function writeHomeToCache(account: string | undefined, saved: HomeDetail) {
    queryClient.setQueryData<HomeDetail>(homeKey(account, saved.id), saved);
    queryClient.setQueryData<MeResponse | undefined>(
      meKey(account),
      (old) =>
        old && {
          ...old,
          homes: old.homes.some((item) => item.id === saved.id)
            ? old.homes.map((item) => (item.id === saved.id ? saved : item))
            : [...old.homes, saved],
        },
    );
  }

  // Operations return true only when their result was applied to this view.
  // Opening a home navigates there; the home query loads it by route id.
  async function selectHome(id: string): Promise<boolean> {
    if (!onOpenHome) return false;
    generationRef.current++;
    setOperationError(null);
    setSignedOutError(null);
    onOpenHome(id);
    return true;
  }

  async function createHome(name: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { home: created } = await createMutation.mutateAsync(name);
      if (!appliesToView(stamp)) return false;
      writeHomeToCache(stamp.accountId, created);
      onOpenHome?.(created.id);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function renameHome(homeId: string, name: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { home: renamed } = await renameMutation.mutateAsync({
        homeId,
        name,
      });
      if (!appliesToView(stamp)) return false;
      writeHomeToCache(stamp.accountId, renamed);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function inviteMember(homeId: string, email: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { home: updated } = await inviteMutation.mutateAsync({
        homeId,
        email,
      });
      if (!appliesToView(stamp)) return false;
      writeHomeToCache(stamp.accountId, updated);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function removeMember(
    homeId: string,
    memberId: string,
  ): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { home: updated } = await removeMutation.mutateAsync({
        homeId,
        memberId,
      });
      if (!appliesToView(stamp)) return false;
      writeHomeToCache(stamp.accountId, updated);
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  async function leaveHome(homeId: string): Promise<boolean> {
    const stamp = beginOperation();
    try {
      const { homes } = await leaveMutation.mutateAsync(homeId);
      if (!appliesToView(stamp)) return false;
      queryClient.setQueryData<MeResponse | undefined>(
        meKey(stamp.accountId),
        (old) => old && { ...old, homes },
      );
      queryClient.removeQueries({
        queryKey: homeKey(stamp.accountId, homeId),
      });
      setIgnoredHomeId(homeId);
      onBackToHomes?.();
      return true;
    } catch (cause) {
      reportFailure(stamp, cause);
      return false;
    }
  }

  function backToHomes() {
    generationRef.current++;
    setOperationError(null);
    onBackToHomes?.();
  }

  function retry() {
    if (auth.getAccountId()) {
      generationRef.current++;
      setExpired(false);
      setSignedOutError(null);
      setOperationError(null);
      void queryClient.invalidateQueries({ queryKey: homesPrefix });
    } else {
      generationRef.current++;
      queryClient.removeQueries({ queryKey: homesPrefix });
      setExpired(false);
      setSignedOutError(null);
      setOperationError(null);
    }
  }

  async function signIn() {
    const stamp = beginOperation();
    setSignInPending(true);
    try {
      await auth.signIn();
      // Account changes load through the subscription. Same-account sign-in may not emit.
      if (appliesToView(stamp) && auth.getAccountId() === stamp.accountId) {
        setExpired(false);
        setSignedOutError(null);
        await queryClient.invalidateQueries({ queryKey: homesPrefix });
      }
    } catch (cause) {
      if (appliesToView(stamp)) setOperationError(auth.errorMessage(cause));
    } finally {
      setSignInPending(false);
    }
  }

  async function signOut() {
    const stamp = beginOperation();
    setSignOutPending(true);
    try {
      await auth.signOut();
      if (!auth.getAccountId()) onSignedOut?.();
    } catch {
      if (appliesToView(stamp))
        setOperationError("We couldn't sign you out. Please try again.");
    } finally {
      setSignOutPending(false);
    }
  }

  return {
    mode,
    me,
    home,
    homeId: selectedHomeId,
    homeError,
    busy,
    error,
    retry,
    signIn,
    signOut,
    selectHome,
    createHome,
    renameHome,
    inviteMember,
    removeMember,
    leaveHome,
    backToHomes,
  };
}

export type HomesController = ReturnType<typeof useHomesController>;
