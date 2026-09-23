import type { Post, Position } from "./board";

/**
 * Server-backed posts for a shared home. BoardApp renders from this instead
 * of its local fixture state when the prop is present; the playground leaves
 * it absent and keeps behaving exactly as before.
 */
export type BoardPostsSource = {
  posts: Post[];
  loading: boolean;
  initialError: string | null;
  error: string | null;
  retry: () => void;
  /** Server-anchored clock for removal countdowns. */
  serverNow: () => number;
  save: (post: Post, isNew: boolean) => Promise<Post | null>;
  move: (id: string, position: Position) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  undo: (id: string) => Promise<boolean>;
};
