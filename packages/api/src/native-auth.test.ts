import { createHash, randomBytes } from "node:crypto";
import { commands } from "@noted/realtime/src";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveNativeSignIn,
  beginNativeSignIn,
  exchangeNativeSignIn,
  nativeSignInInfo,
} from "./services/native-auth";

const mint = vi.hoisted(() =>
  vi.fn(async (subject: string) => `test-token-for-${subject}`),
);
vi.mock("@noted/auth/src", () => ({ createNativeSignInToken: mint }));
vi.mock("@noted/db/src", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async (_predicate: unknown) => [{ subject: "google-alice" }],
      }),
    }),
  },
  users: { authSubject: "auth_subject", id: "id" },
}));
vi.mock("drizzle-orm", () => ({ eq: () => true }));

const requests: string[] = [];
afterEach(async () => {
  for (const id of requests.splice(0))
    await commands.del(`native-signin:${id}`);
  mint.mockClear();
});

async function begin() {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const request = await beginNativeSignIn(challenge);
  requests.push(request.id);
  return { ...request, verifier };
}

describe("native browser sign-in handoff", () => {
  it("reveals no token until the browser explicitly approves, and binds the verifier", async () => {
    const request = await begin();
    expect(await nativeSignInInfo(request.id)).toEqual({
      code: request.code,
      approved: false,
    });
    expect(await exchangeNativeSignIn(request.id, request.verifier)).toEqual({
      status: "pending",
    });
    await expect(
      exchangeNativeSignIn(request.id, "wrong-verifier"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mint).not.toHaveBeenCalled();
  });
  it("supports a lost exchange response without changing the approved account", async () => {
    const request = await begin();
    await approveNativeSignIn(request.id, "alice");
    expect(await exchangeNativeSignIn(request.id, request.verifier)).toEqual({
      status: "approved",
      token: "test-token-for-google-alice",
    });
    expect(await exchangeNativeSignIn(request.id, request.verifier)).toEqual({
      status: "approved",
      token: "test-token-for-google-alice",
    });
    expect(
      await commands.ttl(`native-signin:${request.id}`),
    ).toBeLessThanOrEqual(300);
  });
  it("refuses to replace an already approved subject", async () => {
    const request = await begin();
    const key = `native-signin:${request.id}`;
    const value = JSON.parse((await commands.get(key))!);
    await commands.set(
      key,
      JSON.stringify({ ...value, subject: "google-bob" }),
      "EX",
      300,
    );
    await expect(
      approveNativeSignIn(request.id, "alice"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(JSON.parse((await commands.get(key))!).subject).toBe("google-bob");
  });
  it("rejects expired requests without minting credentials", async () => {
    const request = await begin();
    await commands.del(`native-signin:${request.id}`);
    await expect(
      exchangeNativeSignIn(request.id, request.verifier),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      approveNativeSignIn(request.id, "alice"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mint).not.toHaveBeenCalled();
  });
});
