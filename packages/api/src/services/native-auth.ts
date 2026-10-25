import "server-only";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createNativeSignInToken } from "@noted/auth/src";
import { db, users } from "@noted/db/src";
import { commands } from "@noted/realtime/src";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

interface SignInRequest {
  challenge: string;
  code: string;
  subject?: string;
}
const key = (id: string) => `native-signin:${id}`;

async function request(id: string): Promise<SignInRequest> {
  const value = await commands.get(key(id));
  if (!value)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This sign-in expired. Start again in the app.",
    });
  return JSON.parse(value) as SignInRequest;
}

export async function beginNativeSignIn(challenge: string) {
  const id = randomUUID();
  const code = randomBytes(3).toString("hex").toUpperCase();
  await commands.set(
    key(id),
    JSON.stringify({ challenge, code }),
    "EX",
    300,
    "NX",
  );
  return { id, code };
}

export async function nativeSignInInfo(id: string) {
  const value = await request(id);
  return { code: value.code, approved: Boolean(value.subject) };
}

export async function approveNativeSignIn(id: string, userId: string) {
  const [user] = await db
    .select({ subject: users.authSubject })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const result = await commands.eval(
    `
    local value = redis.call('GET', KEYS[1])
    if not value then return 0 end
    local data = cjson.decode(value)
    if data.subject and data.subject ~= ARGV[1] then return -1 end
    data.subject = ARGV[1]
    redis.call('SET', KEYS[1], cjson.encode(data), 'KEEPTTL')
    return 1
  `,
    1,
    key(id),
    user.subject,
  );
  if (result !== 1)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This sign-in is expired or already approved by another account.",
    });
  return { approved: true as const };
}

export async function exchangeNativeSignIn(id: string, verifier: string) {
  const value = await request(id);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (
    value.challenge.length !== challenge.length ||
    !timingSafeEqual(Buffer.from(value.challenge), Buffer.from(challenge))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This sign-in belongs to a different app session.",
    });
  }
  if (!value.subject) return { status: "pending" as const };
  // Retain the request for its original five-minute TTL: a lost response
  // can retry with the same verifier, without approving a different user.
  return {
    status: "approved" as const,
    token: await createNativeSignInToken(value.subject),
  };
}
