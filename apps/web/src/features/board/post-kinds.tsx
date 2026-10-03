"use client";

import { Spinner } from "@noted/ui/src";
import type { BoardPost, RestoreAnyPostInput } from "@noted/validators/src";

export type TextPost = Extract<BoardPost, { kind: "text" }>;
export type PhotoPost = Extract<BoardPost, { kind: "photo" }>;

// Every kind-specific UI fact lives in this module. A new kind adds one
// record entry, one body component, and one case per switch below — each
// site fails the build until it does, so PostCard and DeleteToast never
// grow another branch.

export interface PostKindMeta {
  removeAriaLabel: string;
  removeLabel: string;
  removingLabel: string;
}

export const POST_KIND_META: Record<BoardPost["kind"], PostKindMeta> = {
  text: {
    removeAriaLabel: "Delete note",
    removeLabel: "Delete note",
    removingLabel: "Deleting…",
  },
  photo: {
    removeAriaLabel: "Archive photo to the book",
    removeLabel: "Archive to photobook",
    removingLabel: "Archiving…",
  },
};

// A switch over every post kind ends with this, so a new kind fails the
// build until each switch handles it.
function assertNever(value: never): never {
  throw new Error(`Unhandled post kind: ${String(value)}`);
}

export function postCardAriaLabel(post: BoardPost): string {
  switch (post.kind) {
    case "text":
      return `Note: ${post.text.slice(0, 80)}`;
    case "photo":
      return "Fridge photo";
  }
  return assertNever(post);
}

export function postCardColors(post: BoardPost): {
  backgroundColor: string;
  color: string | undefined;
} {
  switch (post.kind) {
    case "text":
      return {
        backgroundColor: post.backgroundColor,
        color: post.foregroundColor,
      };
    case "photo":
      return { backgroundColor: "#ffffff", color: undefined };
  }
  return assertNever(post);
}

export function removedToastMessage(post: BoardPost): string {
  switch (post.kind) {
    case "text":
      return `Deleted \u201C${post.text}\u201D`;
    case "photo":
      return "Archived photo";
  }
  return assertNever(post);
}

export function toRestoreInput(post: BoardPost): RestoreAnyPostInput {
  switch (post.kind) {
    case "text":
      return {
        kind: "text",
        postId: post.id,
        text: post.text,
        foregroundColor: post.foregroundColor,
        backgroundColor: post.backgroundColor,
        x: post.x,
        y: post.y,
        createdAt: post.createdAt,
      };
    case "photo":
      return {
        kind: "photo",
        postId: post.id,
        x: post.x,
        y: post.y,
        createdAt: post.createdAt,
      };
  }
  return assertNever(post);
}

function TextPostBody({ post }: { post: TextPost }) {
  return (
    <div className="relative max-h-[min(224px,calc(100cqh_-_20px))] min-h-[min(96px,calc(100cqh_-_20px))] overflow-hidden px-3 pt-5 pb-5 text-[16px] leading-[1.45] break-words whitespace-pre-wrap sm:px-4 sm:text-[17px]">
      {post.text}
    </div>
  );
}

function PhotoPostBody({ post }: { post: PhotoPost }) {
  if (post.status !== "ready" || !post.thumbnailUrl) {
    return (
      <div className="p-1.5">
        <div className="flex aspect-square max-h-[calc(100cqh_-_32px)] w-full items-center justify-center rounded-sm bg-slate-100">
          <Spinner label="Uploading photo…" />
        </div>
      </div>
    );
  }
  return (
    <div className="p-1.5">
      <img
        src={post.thumbnailUrl}
        alt="Fridge note attachment"
        draggable={false}
        className="pointer-events-none max-h-[calc(100cqh_-_32px)] w-full rounded-sm object-contain"
      />
    </div>
  );
}

export function PostBody({ post }: { post: BoardPost }) {
  switch (post.kind) {
    case "text":
      return <TextPostBody post={post} />;
    case "photo":
      return <PhotoPostBody post={post} />;
  }
  return assertNever(post);
}
