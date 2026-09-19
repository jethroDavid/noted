import { listHomes, requireUser } from "@noted/server";

import { apiRoute } from "@/features/api/route-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    return { user, homes: await listHomes(user) };
  });
}
