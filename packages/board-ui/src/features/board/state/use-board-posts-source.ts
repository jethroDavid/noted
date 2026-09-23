import type { BoardPost } from "@noted/contracts";
import type { Post } from "./board";
import type { BoardPostsSource } from "./posts-source";
import { useBoardPosts } from "./use-board-posts";

/**
 * The server lists oldest first; the client layers by index so the newest
 * post renders on top. Ties are impossible: the server orders by
 * (createdAt, id).
 */
export function toClientPost(post: BoardPost, order: number): Post {
  return {
    id: post.id,
    kind: "text",
    text: post.text,
    x: post.x,
    y: post.y,
    background: post.backgroundColor,
    foreground: post.foregroundColor,
    order,
    removedAt: post.deletionRequestedAt
      ? Date.parse(post.deletionRequestedAt)
      : null,
  };
}

/** Adapts the posts controller to the shape BoardApp renders. */
export function useBoardPostsSource(): BoardPostsSource {
  const posts = useBoardPosts();
  const board = posts.board;

  async function savePost(post: Post, isNew: boolean): Promise<Post | null> {
    const saved = isNew
      ? await posts.createPost({
          text: post.text,
          foregroundColor: post.foreground,
          backgroundColor: post.background,
          x: post.x,
          y: post.y,
        })
      : await posts.editPost(post.id, {
          text: post.text,
          foregroundColor: post.foreground,
          backgroundColor: post.background,
        });
    if (!saved) return null;
    const siblings = board?.posts ?? [];
    const index = siblings.findIndex((entry) => entry.id === saved.id);
    return toClientPost(saved, index === -1 ? siblings.length : index);
  }

  return {
    posts: board
      ? board.posts.map((post, order) => toClientPost(post, order))
      : [],
    loading: posts.mode === "loading",
    initialError: posts.mode === "error" ? posts.error : null,
    error: posts.error,
    retry: posts.retry,
    serverNow: posts.serverNow,
    save: savePost,
    move: posts.movePost,
    remove: posts.requestRemoval,
    undo: posts.undoRemoval,
  };
}
