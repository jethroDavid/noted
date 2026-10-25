"use client";

import { Button } from "@noted/ui/src";
import type { BoardPost } from "@noted/validators/src";
import { POST_KIND_META } from "./post-kinds";

export interface PostRemovalProps {
  pending: boolean;
  error: string | null;
  onRemove: () => void;
}

export function PostRemovalAction({
  kind,
  pending,
  error,
  onRemove,
  disabled,
}: PostRemovalProps & { kind: BoardPost["kind"]; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {error && (
        <p role="alert" className="text-[17px] text-[#85513e]">
          {error}
        </p>
      )}
      <Button
        variant="quiet"
        className="px-0 text-[15px] text-[#85513e]"
        aria-label={POST_KIND_META[kind].removeAriaLabel}
        disabled={pending || disabled}
        onClick={onRemove}
      >
        {pending
          ? POST_KIND_META[kind].removingLabel
          : POST_KIND_META[kind].removeLabel}
      </Button>
    </div>
  );
}
