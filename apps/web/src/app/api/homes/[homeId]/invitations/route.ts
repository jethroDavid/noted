import { homeIdSchema, inviteMemberSchema } from "@noted/contracts";
import { inviteMember, requireUser } from "@noted/server";

import { apiRoute, readBody } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string }> };

export async function POST(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const homeId = homeIdSchema.parse((await context.params).homeId);
    const { email } = await readBody(request, inviteMemberSchema);
    return { home: await inviteMember(user, homeId, email) };
  });
}
