import {
  homeResponseSchema,
  homesResponseSchema,
  meResponseSchema,
  type HomeDetail,
  type MeResponse,
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
  };
}

export type NotedApiClient = ReturnType<typeof createApiClient>;
export type { HomeDetail, MeResponse };
