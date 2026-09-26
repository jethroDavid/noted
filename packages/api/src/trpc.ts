import type { AuthErrorCode } from "@noted/auth/src";
import { AuthError, verifyIdToken } from "@noted/auth/src";
import { initTRPC, TRPCError } from "@trpc/server";
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

export async function createContext(opts?: {
  req?: Request;
}): Promise<Context> {
  const authorization = opts?.req?.headers.get("authorization");
  // No token means anonymous (public procedures still work); a present but
  // invalid token throws so expired sign-ins surface instead of degrading.
  if (!authorization?.startsWith("Bearer ")) return { user: null };
  try {
    const identity = await verifyIdToken(authorization.slice(7));
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
