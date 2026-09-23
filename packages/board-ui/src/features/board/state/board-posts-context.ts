import { createContext } from "react";
import type { BoardPostsController } from "./use-board-posts-controller";

export const BoardPostsContext = createContext<BoardPostsController | null>(
  null,
);
