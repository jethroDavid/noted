import { homeIdSchema, postIdSchema } from "@noted/contracts";
import { requestRemoval, requireUser, undoRemoval } from "@noted/server";

import { apiRoute } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string; postId: string }> };

export async function POST(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const postId = postIdSchema.parse(params.postId);
    return { post: await requestRemoval(user, homeId, postId) };
  });
}

export async function DELETE(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const postId = postIdSchema.parse(params.postId);
    return { post: await undoRemoval(user, homeId, postId) };
  });
}
