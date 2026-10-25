"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../platform/auth/auth-provider";
import { useTRPC } from "../../trpc/react";

export function NativeAuthApproval({
  id,
  returnTo,
}: {
  id: string | null;
  returnTo?: "android";
}) {
  const auth = useAuth();
  const trpc = useTRPC();
  const info = useQuery({
    ...trpc.nativeAuth.info.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
    retry: false,
  });
  const approve = useMutation(trpc.nativeAuth.approve.mutationOptions());
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f7f2e7] px-6 text-[#394b38]">
      <section className="w-full max-w-md space-y-6 py-12">
        <h1 className="text-3xl">Sign in to your Noted app</h1>
        {!id ? (
          <p role="alert">Start sign-in from your Noted app.</p>
        ) : info.isError ? (
          <div className="space-y-4">
            <p role="alert">{info.error.message}</p>
            {info.error.data?.code === "UNAUTHORIZED" && (
              <button
                className="min-h-12 rounded border px-5"
                onClick={() => void auth.signIn().then(() => info.refetch())}
              >
                Sign in again
              </button>
            )}
          </div>
        ) : !info.data ? (
          <p role="status">Checking sign-in…</p>
        ) : approve.isSuccess || info.data.approved ? (
          <div className="space-y-4">
            <p role="status">Approved. Return to your Noted app.</p>
            {returnTo === "android" && (
              <a
                className="inline-flex min-h-12 items-center rounded border px-5"
                href="com.noted.app://auth/complete"
              >
                Return to Noted
              </a>
            )}
          </div>
        ) : (
          <>
            <p>Check that your app shows this same code:</p>
            <p className="text-4xl tracking-widest">{info.data.code}</p>
            {auth.status === "signed-in" ? (
              <>
                <p>Continue as {auth.user.email}?</p>
                <button
                  className="min-h-12 rounded border px-5"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate({ id: id! })}
                >
                  Approve sign-in
                </button>
              </>
            ) : (
              <button
                className="min-h-12 rounded border px-5"
                disabled={auth.status === "loading"}
                onClick={() => void auth.signIn()}
              >
                Sign in with Google
              </button>
            )}
          </>
        )}
        {(approve.error || auth.error) && (
          <div>
            <p role="alert">{approve.error?.message ?? auth.error}</p>
            {approve.error?.data?.code === "UNAUTHORIZED" && (
              <button
                className="min-h-12 underline"
                onClick={() => void auth.signIn()}
              >
                Sign in again
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
