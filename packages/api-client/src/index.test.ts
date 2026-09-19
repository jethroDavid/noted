import { afterEach, expect, test, vi } from "vitest";

import { ApiError, createApiClient } from "./index";

afterEach(() => vi.unstubAllGlobals());

test("sends the current Firebase token with a typed home request", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.test",
        displayName: "Alice",
      },
      homes: [],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  expect((await client.me()).user.email).toBe("alice@example.test");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    }),
  );
});

test("surfaces server errors without exposing raw response bodies", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "Home not found." }, { status: 404 }),
    ),
  );
  const client = createApiClient({ getIdToken: async () => "fresh-token" });
  await expect(client.home("missing")).rejects.toEqual(
    new ApiError(404, "Home not found."),
  );
});
