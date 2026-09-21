import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import type { Page } from "@playwright/test";
import type { HomeDetail, MeResponse } from "@noted/contracts";

const local = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
const apiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  local.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  local.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
export const hasBrowserAuthConfig = Boolean(apiKey && projectId);

export const fixtureUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Alex Morgan",
  email: "alex@example.test",
};
export const fixtureHome: HomeDetail = {
  id: "00000000-0000-4000-8000-000000000002",
  boardId: "00000000-0000-4000-8000-000000000003",
  creatorUserId: fixtureUser.id,
  name: "The Sunday home",
  role: "creator",
  members: [
    { ...fixtureUser, isCreator: true },
    {
      id: "00000000-0000-4000-8000-000000000004",
      displayName: "Sam",
      email: "sam@example.test",
      isCreator: false,
    },
  ],
  pendingInvitations: [],
};
export const fixtureMe: MeResponse = {
  user: fixtureUser,
  homes: [
    fixtureHome,
    {
      ...fixtureHome,
      id: "00000000-0000-4000-8000-000000000005",
      name: "The little apartment",
      role: "member",
    },
  ],
};

/** Browser-only fixtures. No real Google account or backend authentication is used. */
export async function installBrowserSession(page: Page) {
  if (!hasBrowserAuthConfig)
    throw new Error(
      "Browser auth fixtures need public Firebase build configuration.",
    );
  const uid = "noted-browser-fixture";
  const expiresAt = Date.now() + 3_600_000;
  const tokenPart = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${tokenPart({ alg: "none", typ: "JWT" })}.${tokenPart({ sub: uid, user_id: uid, aud: projectId, iss: `https://securetoken.google.com/${projectId}`, exp: Math.floor(expiresAt / 1000), iat: Math.floor(Date.now() / 1000), auth_time: Math.floor(Date.now() / 1000), email: fixtureUser.email, email_verified: true, firebase: { sign_in_provider: "google.com" } })}.test-only`;
  await page.route("https://identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      json: {
        users: [
          {
            localId: uid,
            email: fixtureUser.email,
            emailVerified: true,
            displayName: fixtureUser.displayName,
            providerUserInfo: [
              {
                providerId: "google.com",
                rawId: uid,
                email: fixtureUser.email,
              },
            ],
          },
        ],
      },
    }),
  );
  await page.route("https://securetoken.googleapis.com/**", (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: "test-only",
        expires_in: "3600",
        user_id: uid,
        project_id: projectId,
        token_type: "Bearer",
      },
    }),
  );
  // Enter the origin before populating its IndexedDB. The next navigation restores it.
  await page.goto("/app");
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>(
      ".app-header-action button",
    );
    return button && !button.disabled;
  });
  await page.evaluate(
    async ({ key, value }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("firebaseLocalStorageDb", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("firebaseLocalStorage", {
            keyPath: "fbase_key",
          });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(
            "firebaseLocalStorage",
            "readwrite",
          );
          transaction
            .objectStore("firebaseLocalStorage")
            .put({ fbase_key: key, value });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        };
      });
    },
    {
      key: `firebase:authUser:${apiKey}:[DEFAULT]`,
      value: {
        uid,
        email: fixtureUser.email,
        emailVerified: true,
        displayName: fixtureUser.displayName,
        isAnonymous: false,
        providerData: [
          {
            providerId: "google.com",
            uid,
            displayName: fixtureUser.displayName,
            email: fixtureUser.email,
            photoURL: null,
            phoneNumber: null,
          },
        ],
        stsTokenManager: {
          refreshToken: "test-only",
          accessToken: token,
          expirationTime: expiresAt,
        },
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        apiKey,
        appName: "[DEFAULT]",
      },
    },
  );
}
