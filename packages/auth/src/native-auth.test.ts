import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeSignInToken, verifyIdToken } from "./index";

const admin = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getUser: vi.fn(),
  createCustomToken: vi.fn(),
}));
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}] }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => admin }));

beforeEach(() => vi.clearAllMocks());
describe("native Firebase identity seam", () => {
  it("accepts only explicitly marked native custom tokens", async () => {
    const identity = {
      uid: "alice",
      email: "alice@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "custom" },
    };
    admin.verifyIdToken.mockResolvedValue(identity);
    await expect(verifyIdToken("unmarked")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    admin.verifyIdToken.mockResolvedValue({
      ...identity,
      native_session: true,
    });
    await expect(verifyIdToken("marked")).resolves.toMatchObject({
      subject: "alice",
    });
    expect(admin.verifyIdToken).toHaveBeenLastCalledWith("marked", true);
  });
  it("checks the actual Google account before issuing a marked token", async () => {
    admin.getUser.mockResolvedValue({
      disabled: false,
      emailVerified: true,
      providerData: [{ providerId: "google.com" }],
    });
    admin.createCustomToken.mockResolvedValue("test-custom-token");
    await expect(createNativeSignInToken("alice")).resolves.toBe(
      "test-custom-token",
    );
    expect(admin.createCustomToken).toHaveBeenCalledWith("alice", {
      native_session: true,
    });
    admin.getUser.mockResolvedValue({
      disabled: false,
      emailVerified: true,
      providerData: [],
    });
    await expect(createNativeSignInToken("not-google")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(admin.createCustomToken).toHaveBeenCalledTimes(1);
  });
});
