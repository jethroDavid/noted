"use client";

import { Button, Modal } from "@noted/ui/src";
import { UPLOAD_RULES } from "@noted/validators/src";
import type { Reel, ReelsResponse, UploadTicket } from "@noted/validators/src";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTRPC } from "../../trpc/react";
import { useUploadTicket, validateUploadFile } from "../media/upload";

interface ReelUploadModalProps {
  homeId: string;
  reelsQueryKey: QueryKey;
  /** Restored after a failed submit so the user can retry as-is. */
  initialFile?: File | null;
  initialError?: string | null;
  onClose: () => void;
  onMutated: () => void;
  /** Reopens the modal with the file and error after a failed submit. */
  onUploadFailed: (file: File, message: string) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed.";
}

export function ReelUploadModal({
  homeId,
  reelsQueryKey,
  initialFile,
  initialError,
  onClose,
  onMutated,
  onUploadFailed,
}: ReelUploadModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    initialFile ? URL.createObjectURL(initialFile) : null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const { requestTicket, putBytes, confirmAsset } = useUploadTicket(homeId);

  // Revokes the previous preview URL whenever it is replaced, and the
  // current one when the modal unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const create = useMutation(
    trpc.media.createReel.mutationOptions({
      onSuccess: () => onMutated(),
      onError: (mutationError) => setError(mutationError.message),
    }),
  );
  const remove = useMutation(
    trpc.media.deleteReel.mutationOptions({
      onSuccess: () => onMutated(),
      onError: (mutationError) => {
        console.error("Removing a failed upload failed:", mutationError);
        onMutated();
      },
    }),
  );

  function onFileSelected(selected: File | undefined) {
    if (!selected) return;
    const problem = validateUploadFile("video", selected);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function dropOptimistic(tempId: string) {
    queryClient.setQueryData<ReelsResponse>(reelsQueryKey, (old) =>
      old
        ? { ...old, reels: old.reels.filter((reel) => reel.id !== tempId) }
        : old,
    );
  }

  // Runs after the modal has closed: ticket, instant reel, background PUT,
  // confirm. Any failure drops the optimistic card and reopens the modal
  // with the file intact for retry.
  async function runUpload(pending: File, tempId: string) {
    let ticket: UploadTicket;
    try {
      ticket = await requestTicket("video", pending);
    } catch (ticketError) {
      dropOptimistic(tempId);
      onUploadFailed(pending, errorMessage(ticketError));
      return;
    }
    let reelId: string;
    try {
      const created = await create.mutateAsync({
        homeId,
        assetId: ticket.assetId,
      });
      reelId = created.id;
    } catch (createError) {
      dropOptimistic(tempId);
      onUploadFailed(pending, errorMessage(createError));
      return;
    }
    onMutated();
    try {
      await putBytes(ticket.uploadUrl, pending);
      await confirmAsset(ticket.assetId);
      onMutated();
    } catch (backgroundError) {
      console.error("Background reel upload failed:", backgroundError);
      // A failed upload leaves no trace: the spinner reel is deleted and
      // its orphaned asset is cleaned up server-side.
      dropOptimistic(tempId);
      remove.mutate({ homeId, reelId });
      onUploadFailed(pending, errorMessage(backgroundError));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    // Show the spinner card instantly, before the server responds. The
    // refetch swaps the real reel in; failures drop this card.
    const tempId = crypto.randomUUID();
    const optimistic: Reel = {
      id: tempId,
      homeId,
      status: "uploading",
      videoUrl: null,
      posterUrl: null,
      createdAt: new Date(),
    };
    queryClient.setQueryData<ReelsResponse>(reelsQueryKey, (old) =>
      old ? { ...old, reels: [optimistic, ...old.reels] } : old,
    );
    // Close at once — the whole upload runs after, and a failure reopens
    // this modal with the file and error intact.
    onClose();
    void runUpload(file, tempId);
  }

  return (
    <Modal title="Upload a reel" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {previewUrl ? (
          <div>
            {/* Uploads ship no caption tracks; captions are out of scope. */}
            <video
              src={previewUrl}
              controls
              muted
              playsInline
              preload="metadata"
              className="max-h-72 w-full rounded-lg bg-black"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-2 text-[17px] font-medium text-[#394b38] underline hover:text-[#394b38]"
            >
              Choose a different clip
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-lg border border-dashed border-[#829070]/40 px-4 py-8 text-[17px] font-medium text-[#394b38] hover:border-[#42583d]"
          >
            Choose a clip
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={UPLOAD_RULES.video.contentTypes.join(",")}
          className="hidden"
          aria-label="Choose a clip"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            onFileSelected(selected);
          }}
        />
        {error && (
          <p role="alert" className="text-[17px] text-[#85513e]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="quiet">
            Cancel
          </Button>
          <Button type="submit" disabled={!file}>
            Post it
          </Button>
        </div>
      </form>
    </Modal>
  );
}
