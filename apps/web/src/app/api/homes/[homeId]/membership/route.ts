import { homeIdSchema } from "@noted/contracts";
import { leaveHome, requireUser } from "@noted/server";

import { apiRoute } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string }> };

export async function DELETE(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const homeId = homeIdSchema.parse((await context.params).homeId);
    return { homes: await leaveHome(user, homeId) };
  });
}
