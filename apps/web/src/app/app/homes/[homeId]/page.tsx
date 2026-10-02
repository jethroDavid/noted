"use client";

import { Button } from "@noted/ui/src";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { BoardView } from "../../../../features/board/board-view";
import { MembersPanel } from "../../../../features/board/members-panel";
import { BookView } from "../../../../features/book/book-view";
import { ReelsView } from "../../../../features/tv/reels-view";
import { useAuth } from "../../../../platform/auth/auth-provider";
import { useTRPC } from "../../../../trpc/react";

type HomeTab = "fridge" | "tv" | "book";

const TABS: Array<{ id: HomeTab; label: string }> = [
  { id: "fridge", label: "Fridge" },
  { id: "tv", label: "TV" },
  { id: "book", label: "Book" },
];

export default function HomeDetailPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = use(params);
  const auth = useAuth();
  const trpc = useTRPC();
  const router = useRouter();
  const [membersOpen, setMembersOpen] = useState(false);
  const [tab, setTab] = useState<HomeTab>("fridge");

  const homeQuery = useQuery({
    ...trpc.homes.get.queryOptions({ homeId }),
    enabled: auth.status === "signed-in",
  });

  if (auth.status === "loading") {
    return <p className="p-8 text-center text-slate-600">Loading…</p>;
  }
  if (auth.status !== "signed-in") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-slate-700">Sign in to open this home.</p>
        <Link href="/" className="text-slate-900 underline">
          Back to sign-in
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900">
      <header className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-sm text-slate-300 hover:text-white">
            ← Homes
          </Link>
          <h1 className="text-lg font-semibold text-white">
            {homeQuery.data?.home.name ?? "Home"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Home sections" className="flex gap-1">
            {TABS.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setTab(candidate.id)}
                aria-current={tab === candidate.id ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  tab === candidate.id
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {candidate.label}
              </button>
            ))}
          </nav>
          <Button
            onClick={() => setMembersOpen((open) => !open)}
            className="bg-white text-slate-900"
          >
            {membersOpen ? "Hide members" : "Members"}
          </Button>
        </div>
      </header>

      {tab === "fridge" && <BoardView homeId={homeId} />}
      {tab === "tv" && <ReelsView homeId={homeId} />}
      {tab === "book" && <BookView homeId={homeId} />}

      {membersOpen && (
        <MembersPanel
          homeId={homeId}
          onClose={() => setMembersOpen(false)}
          onLeave={() => router.push("/app")}
        />
      )}
    </main>
  );
}
