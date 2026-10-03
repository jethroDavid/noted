"use client";

import { Button, Modal } from "@noted/ui/src";
import { UPLOAD_RULES } from "@noted/validators/src";
import type {
  BoardPost,
  BoardPostsResponse,
  UploadTicket,
} from "@noted/validators/src";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTRPC } from "../../trpc/react";
import { useUploadTicket, validateUploadFile } from "../media/upload";

interface PhotoPickerModalProps {
  homeId: string;
  boardId: string;
  boardQueryKey: QueryKey;
  /** Restored after a failed submit so the user can retry as-is. */
  initialFile?: File | null;
  initialError?: string | null;
  onClose: () => void;
  onMutated: () => void;
  /** Reopens the modal with the file and error after a failed submit. */
  onUploadFailed: (file: File, message: string) => void;
}

function scatter(): { x: number; y: number } {
  return {
    x: 0.5 + (Math.random() - 0.5) * 0.1,
    y: 0.5 + (Math.random() - 0.5) * 0.1,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed.";
}

export function PhotoPickerModal({
  homeId,
  boardId,
  boardQueryKey,
  initialFile,
  initialError,
  onClose,
  onMutated,
  onUploadFailed,
}: PhotoPickerModalProps) {
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

  const createUploaded = useMutation(
    trpc.boards.createUploadedPhoto.mutationOptions({
      onSuccess: () => onMutated(),
      onError: (mutationError) => setError(mutationError.message),
    }),
  );
  const remove = useMutation(
    trpc.boards.removePost.mutationOptions({
      onSuccess: () => onMutated(),
      onError: (mutationError) => {
        console.error("Removing a failed upload failed:", mutationError);
        onMutated();
      },
    }),
  );

  function onFileSelected(selected: File | undefined) {
    if (!selected) return;
    const problem = validateUploadFile("photo", selected);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function dropOptimistic(tempId: string) {
    queryClient.setQueryData<BoardPostsResponse>(boardQueryKey, (old) =>
      old
        ? { ...old, posts: old.posts.filter((post) => post.id !== tempId) }
        : old,
    );
  }

  // Runs after the modal has closed: ticket, instant post, background PUT,
  // confirm. Any failure drops the optimistic card and reopens the modal
  // with the file intact for retry.
  async function runUpload(
    pending: File,
    optimistic: { tempId: string; x: number; y: number },
  ) {
    let ticket: UploadTicket;
    try {
      ticket = await requestTicket("photo", pending);
    } catch (ticketError) {
      dropOptimistic(optimistic.tempId);
      onUploadFailed(pending, errorMessage(ticketError));
      return;
    }

    let postId: string;
    try {
      const created = await createUploaded.mutateAsync({
        homeId,
        boardId,
        assetId: ticket.assetId,
        x: optimistic.x,
        y: optimistic.y,
      });
      postId = created.id;
    } catch (createError) {
      dropOptimistic(optimistic.tempId);
      onUploadFailed(pending, errorMessage(createError));
      return;
    }

    onMutated();

    try {
      await putBytes(ticket.uploadUrl, pending);
      await confirmAsset(ticket.assetId);
      onMutated();
    } catch (backgroundError) {
      console.error("Background photo upload failed:", backgroundError);
      // A failed upload leaves no trace: the spinner post is removed and
      // its orphaned asset is cleaned up server-side.
      dropOptimistic(optimistic.tempId);
      remove.mutate({ homeId, postId });
      onUploadFailed(pending, errorMessage(backgroundError));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    // Show the spinner card instantly, before the server responds. The real
    // post reuses these coordinates, so the refetch swaps it in with no jump.
    const position = scatter();
    const tempId = crypto.randomUUID();
    const now = new Date();
    const optimistic: BoardPost = {
      id: tempId,
      boardId,
      kind: "photo",
      status: "uploading",
      imageUrl: null,
      thumbnailUrl: null,
      x: position.x,
      y: position.y,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<BoardPostsResponse>(boardQueryKey, (old) =>
      old ? { ...old, posts: [...old.posts, optimistic] } : old,
    );
    // Close at once — the whole upload runs after, and a failure reopens
    // this modal with the file and error intact.
    onClose();
    void runUpload(file, { tempId, ...position });
  }

  return (
    <Modal title="Stick a photo" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {previewUrl ? (
          <div>
            <img
              src={previewUrl}
              alt="Selected upload preview"
              className="max-h-72 w-full rounded-lg bg-[#ebe9d9] object-contain"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-2 text-[17px] font-medium text-[#394b38] underline hover:text-[#394b38]"
            >
              Choose a different photo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-lg border border-dashed border-[#829070]/40 px-4 py-8 text-[17px] font-medium text-[#394b38] hover:border-[#42583d]"
          >
            Choose a photo
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={UPLOAD_RULES.photo.contentTypes.join(",")}
          className="hidden"
          aria-label="Choose a photo"
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
            Stick it
          </Button>
        </div>
      </form>
    </Modal>
  );
}
