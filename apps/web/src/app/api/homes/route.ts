import { createHomeSchema } from "@noted/contracts";
import { createHome, listHomes, requireUser } from "@noted/server";

import { apiRoute, readBody } from "@/features/api/route-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return apiRoute(async () => ({
    homes: await listHomes(await requireUser(request)),
  }));
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const { name } = await readBody(request, createHomeSchema);
    return { home: await createHome(user, name) };
  }, 201);
}
