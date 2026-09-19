import { homeIdSchema, renameHomeSchema } from "@noted/contracts";
import { getHome, renameHome, requireUser } from "@noted/server";

import { apiRoute, readBody } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string }> };

export async function GET(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const homeId = homeIdSchema.parse((await context.params).homeId);
    return { home: await getHome(user, homeId) };
  });
}

export async function PATCH(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const homeId = homeIdSchema.parse((await context.params).homeId);
    const { name } = await readBody(request, renameHomeSchema);
    return { home: await renameHome(user, homeId, name) };
  });
}
