import {
  homeIdSchema,
  postIdSchema,
  updatePostPositionSchema,
} from "@noted/contracts";
import { movePost, requireUser } from "@noted/server";

import { apiRoute, readBody } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string; postId: string }> };

export async function PATCH(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const postId = postIdSchema.parse(params.postId);
    const input = await readBody(request, updatePostPositionSchema);
    return { post: await movePost(user, homeId, postId, input) };
  });
}
