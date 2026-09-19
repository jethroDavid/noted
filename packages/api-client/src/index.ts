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
  ): Promise<T> {
    const token = await options.getIdToken();
    const response = await fetch(`${base}/api${path}`, {
      method,
      cache: "no-store",
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
    me: () => request("/me", meResponseSchema),
    homes: () => request("/homes", homesResponseSchema),
    createHome: (name: string) =>
      request("/homes", homeResponseSchema, "POST", { name }),
    home: (id: string) => request(homePath(id), homeResponseSchema),
    renameHome: (id: string, name: string) =>
      request(homePath(id), homeResponseSchema, "PATCH", { name }),
    invite: (id: string, email: string) =>
      request(`${homePath(id)}/invitations`, homeResponseSchema, "POST", {
        email,
      }),
    removeMember: (id: string, userId: string) =>
      request(
        `${homePath(id)}/members/${encodeURIComponent(userId)}`,
        homeResponseSchema,
        "DELETE",
      ),
    leaveHome: (id: string) =>
      request(`${homePath(id)}/membership`, homesResponseSchema, "DELETE"),
  };
}

export type NotedApiClient = ReturnType<typeof createApiClient>;
export type { HomeDetail, MeResponse };
