import { createContext } from "react";
import type { FridgePostsController } from "./use-fridge-posts-controller";

export const FridgePostsContext = createContext<FridgePostsController | null>(
  null,
);
