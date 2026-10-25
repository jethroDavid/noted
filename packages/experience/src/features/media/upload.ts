"use client";

import { UPLOAD_RULES } from "@noted/validators/src";
import type { UploadKind, UploadTicket } from "@noted/validators/src";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useTRPC } from "../../trpc/react";

// Client-side pre-check against the same rules the server enforces, so
// hopeless files fail instantly instead of after a ticket round-trip.
export function validateUploadFile(
  kind: UploadKind,
  file: File,
): string | null {
  const rules = UPLOAD_RULES[kind];
  if (file.size === 0) return "That file is empty.";
  if (!(rules.contentTypes as readonly string[]).includes(file.type)) {
    return `${file.name || "That file"} is not a supported ${kind} (${rules.contentTypes.join(", ")}).`;
  }
  if (file.size > rules.maxBytes) {
    const capMb = Math.round(rules.maxBytes / (1024 * 1024));
    return `${file.name || "That file"} exceeds the ${capMb}MB ${kind} cap.`;
  }
  return null;
}

async function putUploadBytes(
  uploadUrl: string,
  file: File,
  checksum: string,
): Promise<void> {
  // The ticket binds content type and size: the PUT must match the
  // approved values exactly (fetch sets content-length itself).
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type, "x-amz-checksum-sha256": checksum },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}.`);
  }
}

// Instant-post uploads in three steps: request a ticket, create the post
// or reel against it immediately (subscribers see a spinner), then PUT the
// bytes in the background and confirm so the server queues processing.
export function useUploadTicket(homeId: string) {
  const checksums = useRef(new Map<string, string>());
  const trpc = useTRPC();
  const request = useMutation(trpc.media.requestUpload.mutationOptions());
  const confirm = useMutation(trpc.media.confirmUpload.mutationOptions());
  const cancel = useMutation(trpc.media.cancelUpload.mutationOptions());

  async function requestTicket(
    kind: UploadKind,
    file: File,
  ): Promise<UploadTicket> {
    const problem = validateUploadFile(kind, file);
    if (problem) throw new Error(problem);
    const checksum = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      ),
    );
    const ticket = await request.mutateAsync({
      homeId,
      kind,
      contentType: file.type,
      byteSize: file.size,
      checksum,
    });
    checksums.current.set(ticket.uploadUrl, checksum);
    return ticket;
  }

  async function putBytes(uploadUrl: string, file: File): Promise<void> {
    const checksum = checksums.current.get(uploadUrl);
    if (!checksum)
      throw Error("Missing upload integrity context. Choose the file again.");
    await putUploadBytes(uploadUrl, file, checksum);
  }

  async function confirmAsset(assetId: string): Promise<void> {
    await confirm.mutateAsync({ homeId, assetId });
  }

  return {
    requestTicket,
    putBytes,
    confirmAsset,
    cancelAsset: async (assetId: string) => {
      await cancel.mutateAsync({ homeId, assetId });
    },
    requesting: request.isPending || confirm.isPending,
  };
}
