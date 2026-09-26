"use client";

import { Button } from "@noted/ui/src";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../platform/auth/auth-provider";
import { useTRPC } from "../../trpc/react";

export default function HomesPage() {
  const auth = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const meOptions = trpc.me.get.queryOptions();
  const me = useQuery({
    ...meOptions,
    enabled: auth.status === "signed-in",
  });
  const create = useMutation(
    trpc.homes.create.mutationOptions({
      onSuccess: () => {
        setName("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: meOptions.queryKey });
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  if (auth.status === "loading") {
    return <p className="p-8 text-center text-slate-600">Loading…</p>;
  }
  if (auth.status !== "signed-in") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-slate-700">Sign in to see your homes.</p>
        <Link href="/" className="text-slate-900 underline">
          Back to sign-in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your homes</h1>
          <p className="text-sm text-slate-600">
            Signed in as {auth.user.displayName ?? auth.user.email}
          </p>
        </div>
        <Button
          onClick={() => auth.signOut()}
          className="bg-slate-200 text-slate-900"
        >
          Sign out
        </Button>
      </div>

      {me.isLoading && <p className="text-slate-600">Loading homes…</p>}
      {me.error && (
        <p role="alert" className="text-red-600">
          {me.error.message}
        </p>
      )}
      {me.data && (
        <ul className="flex flex-col gap-3">
          {me.data.homes.map((home) => (
            <li key={home.id}>
              <Link
                href={`/app/homes/${home.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-900"
              >
                <span className="font-medium text-slate-900">{home.name}</span>
                <span className="text-sm text-slate-500">{home.role}</span>
              </Link>
            </li>
          ))}
          {me.data.homes.length === 0 && (
            <li className="text-slate-600">
              No homes yet — create one below, or ask a creator to invite you.
            </li>
          )}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim() });
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New home name"
          maxLength={80}
          aria-label="New home name"
          className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-slate-900"
        />
        <Button type="submit" disabled={create.isPending}>
          Create home
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
