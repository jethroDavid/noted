import "server-only";
import type { AuthErrorCode } from "@noted/auth/src";
import { AuthError, verifyIdToken } from "@noted/auth/src";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import type { CurrentUser } from "./services/identity";
import { syncVerifiedUser } from "./services/identity";

export interface Context {
  user: CurrentUser | null;
}

function toTRPCCode(code: AuthErrorCode): TRPCError["code"] {
  switch (code) {
    case "UNAUTHENTICATED":
      return "UNAUTHORIZED";
    case "FORBIDDEN":
      return "FORBIDDEN";
    case "UNAVAILABLE":
      return "PRECONDITION_FAILED";
  }
}

async function contextForToken(token: string | null): Promise<Context> {
  // No token means anonymous (public procedures still work); a present but
  // invalid token throws so expired sign-ins surface instead of degrading.
  if (!token) return { user: null };
  try {
    const identity = await verifyIdToken(token);
    return { user: await syncVerifiedUser(identity) };
  } catch (error) {
    if (error instanceof AuthError) {
      throw new TRPCError({
        code: toTRPCCode(error.code),
        message: error.message,
      });
    }
    throw error;
  }
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<Context> {
  const authorization = opts.req.headers.get("authorization");
  const headerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  // EventSource (SSE subscriptions) cannot set headers, so the client sends
  // its Firebase ID token as connection params instead; the adapter parses
  // them out of the query string into info. Queries and mutations keep the
  // header. A request carries one or the other, never both.
  const token = headerToken ?? opts.info.connectionParams?.token ?? null;
  return contextForToken(token);
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const authed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to continue.",
    });
  }
  return next({ ctx: { user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(authed);
