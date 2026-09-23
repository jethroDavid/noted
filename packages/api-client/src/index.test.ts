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
  const token = "fresh-token";
  const client = createApiClient({ getIdToken: async () => token });

  expect((await client.me()).user.email).toBe("alice@example.test");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
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

test("forwards an abort signal to fetch", async () => {
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
  const controller = new AbortController();

  await client.me({ signal: controller.signal });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({ signal: controller.signal }),
  );
});

test("an aborted request rejects so the caller can ignore it", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
      init?.signal?.throwIfAborted();
      return Response.json({
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "alice@example.test",
          displayName: "Alice",
        },
        homes: [],
      });
    }),
  );
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  const pending = client.me({ signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow();
});

const homeId = "00000000-0000-4000-8000-00000000000a";
const boardId = "00000000-0000-4000-8000-00000000000b";
const postId = "00000000-0000-4000-8000-00000000000c";

function boardPayload() {
  return {
    board: { id: boardId, homeId, postAdditions: 2 },
    posts: [
      {
        id: postId,
        boardId,
        kind: "text",
        text: "Oat milk",
        foregroundColor: "#33352e",
        backgroundColor: "#f5dfa0",
        x: 0.3,
        y: 0.4,
        createdAt: "2026-09-21T10:00:00.000Z",
        updatedAt: "2026-09-21T10:05:00.000Z",
        deletionRequestedAt: null,
        deleteAfter: null,
      },
    ],
    serverTime: "2026-09-21T11:30:00.000Z",
  };
}

test("reads a board through the nested home path", async () => {
  const fetchMock = vi.fn(async () => Response.json(boardPayload()));
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  const board = await client.boardPosts(homeId, boardId);
  expect(board.posts.map((post) => post.text)).toEqual(["Oat milk"]);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/homes/${homeId}/boards/${boardId}`,
    expect.objectContaining({ method: "GET" }),
  );
});

test("creates a post with its content and starting position", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ post: boardPayload().posts[0] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  const input = {
    text: "Oat milk",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
  };
  expect((await client.createPost(homeId, boardId, input)).post.text).toBe(
    "Oat milk",
  );
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/homes/${homeId}/boards/${boardId}/posts`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
});

test("moves a post through the position endpoint without content", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ post: boardPayload().posts[0] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  await client.movePost(homeId, postId, { x: 0.6, y: 0.7 });
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/homes/${homeId}/posts/${postId}/position`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ x: 0.6, y: 0.7 }),
    }),
  );
});

test("requests and undoes removal through the removal endpoint", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ post: boardPayload().posts[0] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = createApiClient({ getIdToken: async () => "fresh-token" });

  await client.requestRemoval(homeId, postId);
  await client.undoRemoval(homeId, postId);
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    `/api/homes/${homeId}/posts/${postId}/removal`,
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    `/api/homes/${homeId}/posts/${postId}/removal`,
    expect.objectContaining({ method: "DELETE" }),
  );
});

test("surfaces removal conflicts with the server message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: "The one-hour Undo period has ended." },
        { status: 409 },
      ),
    ),
  );
  const client = createApiClient({ getIdToken: async () => "fresh-token" });
  await expect(client.undoRemoval(homeId, postId)).rejects.toEqual(
    new ApiError(409, "The one-hour Undo period has ended."),
  );
});
