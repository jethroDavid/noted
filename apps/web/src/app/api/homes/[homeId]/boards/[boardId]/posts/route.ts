import {
  boardIdSchema,
  createPostSchema,
  homeIdSchema,
} from "@noted/contracts";
import { createTextPost, requireUser } from "@noted/server";

import { apiRoute, readBody } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string; boardId: string }> };

export async function POST(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const boardId = boardIdSchema.parse(params.boardId);
    const input = await readBody(request, createPostSchema);
    return { post: await createTextPost(user, homeId, boardId, input) };
  }, 201);
}
