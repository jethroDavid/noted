import {
  boardPostsResponseSchema,
  homeResponseSchema,
  homesResponseSchema,
  meResponseSchema,
  postResponseSchema,
  type BoardPost,
  type BoardPostsResponse,
  type CreatePostInput,
  type HomeDetail,
  type MeResponse,
  type UpdatePostContentInput,
  type UpdatePostPositionInput,
} from "@noted/contracts";

type Schema<T> = { parse(value: unknown): T };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions = {
  /** Forwarded to fetch so queries can cancel superseded requests. */
  signal?: AbortSignal;
};

export function createApiClient(options: {
  baseUrl?: string;
  getIdToken: () => Promise<string>;
}) {
  const base = (options.baseUrl ?? "").replace(/\/$/, "");

  async function request<T>(
    path: string,
    schema: Schema<T>,
    method = "GET",
    body?: object,
    requestOptions?: ApiRequestOptions,
  ): Promise<T> {
    const token = await options.getIdToken();
    const response = await fetch(`${base}/api${path}`, {
      method,
      cache: "no-store",
      signal: requestOptions?.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => ({}));
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Request failed (${response.status}).`;
      throw new ApiError(response.status, message);
    }
    return schema.parse(await response.json());
  }

  const homePath = (id: string) => `/homes/${encodeURIComponent(id)}`;
  const boardPath = (homeId: string, boardId: string) => `${homePath(homeId)}/boards/${encodeURIComponent(boardId)}`;
  const postPath = (homeId: string, postId: string) => `${homePath(homeId)}/posts/${encodeURIComponent(postId)}`;

  return {
    me: (requestOptions?: ApiRequestOptions) =>
      request("/me", meResponseSchema, "GET", undefined, requestOptions),
    homes: (requestOptions?: ApiRequestOptions) =>
      request("/homes", homesResponseSchema, "GET", undefined, requestOptions),
    createHome: (name: string, requestOptions?: ApiRequestOptions) =>
      request("/homes", homeResponseSchema, "POST", { name }, requestOptions),
    home: (id: string, requestOptions?: ApiRequestOptions) =>
      request(
        homePath(id),
        homeResponseSchema,
        "GET",
        undefined,
        requestOptions,
      ),
    renameHome: (
      id: string,
      name: string,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        homePath(id),
        homeResponseSchema,
        "PATCH",
        { name },
        requestOptions,
      ),
    invite: (id: string, email: string, requestOptions?: ApiRequestOptions) =>
      request(
        `${homePath(id)}/invitations`,
        homeResponseSchema,
        "POST",
        { email },
        requestOptions,
      ),
    removeMember: (
      id: string,
      userId: string,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        `${homePath(id)}/members/${encodeURIComponent(userId)}`,
        homeResponseSchema,
        "DELETE",
        undefined,
        requestOptions,
      ),
    leaveHome: (id: string, requestOptions?: ApiRequestOptions) =>
      request(
        `${homePath(id)}/membership`,
        homesResponseSchema,
        "DELETE",
        undefined,
        requestOptions,
      ),
    boardPosts: (
      homeId: string,
      boardId: string,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        boardPath(homeId, boardId),
        boardPostsResponseSchema,
        "GET",
        undefined,
        requestOptions,
      ),
    createPost: (
      homeId: string,
      boardId: string,
      input: CreatePostInput,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        `${boardPath(homeId, boardId)}/posts`,
        postResponseSchema,
        "POST",
        input,
        requestOptions,
      ),
    editPost: (
      homeId: string,
      postId: string,
      input: UpdatePostContentInput,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        postPath(homeId, postId),
        postResponseSchema,
        "PATCH",
        input,
        requestOptions,
      ),
    movePost: (
      homeId: string,
      postId: string,
      input: UpdatePostPositionInput,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        `${postPath(homeId, postId)}/position`,
        postResponseSchema,
        "PATCH",
        input,
        requestOptions,
      ),
    requestRemoval: (
      homeId: string,
      postId: string,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        `${postPath(homeId, postId)}/removal`,
        postResponseSchema,
        "POST",
        undefined,
        requestOptions,
      ),
    undoRemoval: (
      homeId: string,
      postId: string,
      requestOptions?: ApiRequestOptions,
    ) =>
      request(
        `${postPath(homeId, postId)}/removal`,
        postResponseSchema,
        "DELETE",
        undefined,
        requestOptions,
      ),
  };
}

export type NotedApiClient = ReturnType<typeof createApiClient>;
export type { BoardPost, BoardPostsResponse, HomeDetail, MeResponse };
