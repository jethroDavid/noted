"use client";

import { BoardStage, Button } from "@noted/ui/src";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc/react";

export default function HomePage() {
  const trpc = useTRPC();
  const greeting = useQuery(trpc.hello.greet.queryOptions({}));

  return (
    <BoardStage>
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Noted</h1>
        <p>{greeting.data ?? "Loading…"}</p>
        <Button onClick={() => greeting.refetch()}>Refetch greeting</Button>
      </div>
    </BoardStage>
  );
}
