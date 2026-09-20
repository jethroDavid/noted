import { createContext } from "react";
import type { HomesController } from "./use-homes-controller";

export const HomesContext = createContext<HomesController | null>(null);
