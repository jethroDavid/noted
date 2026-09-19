import { homeIdSchema } from "@noted/contracts";
import { removeMember, requireUser } from "@noted/server";

import { apiRoute } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string; memberId: string }> };

export async function DELETE(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const memberId = homeIdSchema.parse(params.memberId);
    return { home: await removeMember(user, homeId, memberId) };
  });
}
