"use client";

import { Button } from "@noted/ui/src";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../platform/auth/auth-provider";

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed-in") router.push("/app");
  }, [auth.status, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-8 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Noted</h1>
      <p className="max-w-md text-slate-600">
        A shared family kitchen board — fridge notes, TV reels, and a photo book
        that archives itself.
      </p>

      {auth.status === "unconfigured" && (
        <p role="alert" className="max-w-md text-amber-700">
          Firebase web configuration is missing. Fill in the
          NEXT_PUBLIC_FIREBASE_* values in .env to enable Google sign-in.
        </p>
      )}
      {auth.status === "loading" && <p className="text-slate-600">Loading…</p>}
      {auth.status === "signed-out" && (
        <Button onClick={() => auth.signIn()}>Sign in with Google</Button>
      )}
      {auth.status === "signed-in" && (
        <Link href="/app" className="text-slate-900 underline">
          Open your homes →
        </Link>
      )}
      {auth.error && (
        <p role="alert" className="max-w-md text-red-600">
          {auth.error}
        </p>
      )}
    </main>
  );
}
