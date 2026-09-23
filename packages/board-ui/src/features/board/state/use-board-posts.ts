import { useContext } from "react";
import { BoardPostsContext } from "./board-posts-context";

/** Read the existing provider's state and operations; do not create new state. */
export function useBoardPosts() {
  const posts = useContext(BoardPostsContext);
  if (!posts)
    throw new Error("useBoardPosts must be used inside BoardPostsProvider.");
  return posts;
}
