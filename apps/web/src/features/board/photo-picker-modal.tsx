"use client";

import { PHOTO_FIXTURES, photoFixtureImageUrl } from "@noted/domain/src";
import { Modal } from "@noted/ui/src";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../../trpc/react";

interface PhotoPickerModalProps {
  homeId: string;
  boardId: string;
  onClose: () => void;
  onMutated: () => void;
}

export function PhotoPickerModal({
  homeId,
  boardId,
  onClose,
  onMutated,
}: PhotoPickerModalProps) {
  const trpc = useTRPC();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.boards.createPhoto.mutationOptions({
      onSuccess: () => {
        onMutated();
        onClose();
      },
      onError: (mutationError) => setError(mutationError.message),
    }),
  );

  return (
    <Modal title="Stick a photo" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        Phase 1 sticks bundled photos; uploads land in Phase 3.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {PHOTO_FIXTURES.map((fixture) => (
          <button
            key={fixture.key}
            type="button"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                homeId,
                boardId,
                fixture: fixture.key,
                x: 0.5 + (Math.random() - 0.5) * 0.1,
                y: 0.5 + (Math.random() - 0.5) * 0.1,
              })
            }
            className="group overflow-hidden rounded-lg border border-slate-200 hover:border-slate-900 disabled:opacity-50"
          >
            <img
              src={photoFixtureImageUrl(fixture.key)}
              alt={fixture.label}
              className="aspect-square w-full object-cover"
            />
            <span className="block p-1 text-center text-xs text-slate-700">
              {fixture.label}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}
