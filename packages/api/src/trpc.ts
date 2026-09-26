import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Phase 0 context is empty; Phase 1 adds the verified Firebase user here.
export interface Context {
  userId: string | null;
}

export async function createContext(): Promise<Context> {
  return { userId: null };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
