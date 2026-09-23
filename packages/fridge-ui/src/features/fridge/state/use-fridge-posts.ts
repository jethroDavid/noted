import { useContext } from "react";
import { FridgePostsContext } from "./fridge-posts-context";

/** Read the existing provider's state and operations; do not create new state. */
export function useFridgePosts() {
  const posts = useContext(FridgePostsContext);
  if (!posts)
    throw new Error("useFridgePosts must be used inside FridgePostsProvider.");
  return posts;
}
