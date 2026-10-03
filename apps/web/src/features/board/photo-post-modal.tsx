"use client";

import { Button, Modal, Spinner } from "@noted/ui/src";
import type { PhotoPost } from "./post-kinds";
import { PostRemovalAction } from "./post-removal-action";
import type { PostRemovalProps } from "./post-removal-action";

export function PhotoPostModal({
  post,
  removal,
  onClose,
}: {
  post: PhotoPost;
  removal: PostRemovalProps;
  onClose: () => void;
}) {
  return (
    <Modal title="" onClose={onClose}>
      {post.status === "ready" && post.imageUrl ? (
        // Preserve the original upload's intrinsic ratio and signed URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt="Fridge attachment at full size"
          draggable={false}
          className="max-h-[55svh] w-full rounded-[3px_7px_4px_6px] bg-[#fffaf0] object-contain"
        />
      ) : (
        <div
          role="status"
          className="flex min-h-40 items-center justify-center"
        >
          <Spinner label="Preparing photo…" />
        </div>
      )}
      <div className="mt-4 flex items-end justify-between gap-3">
        <PostRemovalAction kind="photo" {...removal} />
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
