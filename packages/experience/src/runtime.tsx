"use client";

import { ConnectionPill as OnlineConnectionPill } from "@noted/ui/src";
import { createContext, useContext } from "react";

export interface OfflineContent {
  online: boolean;
  statusLabel: string;
  retrySync?(): Promise<void>;
  loadOlderMemories?(): void;
  savePhoto(input: {
    homeId: string;
    boardId: string;
    file: File;
    x: number;
    y: number;
  }): Promise<void>;
  saveVideo(input: { homeId: string; file: File }): Promise<void>;
}
export const OfflineContentContext = createContext<OfflineContent | null>(null);
export const useOfflineContent = () => useContext(OfflineContentContext);
export function ConnectionPill({
  status,
}: {
  status: "idle" | "connecting" | "pending" | "error";
}) {
  const offline = useOfflineContent();
  return offline ? (
    <p role="status" className="py-1 text-[15px] text-[#65705a]">
      {offline.statusLabel}
      {offline.retrySync && (
        <button
          className="ml-3 min-h-11 underline"
          onClick={() => void offline.retrySync?.().catch(() => {})}
        >
          Retry sync
        </button>
      )}
    </p>
  ) : (
    <OnlineConnectionPill status={status} />
  );
}
