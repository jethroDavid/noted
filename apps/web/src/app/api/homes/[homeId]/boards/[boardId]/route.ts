import { boardIdSchema, homeIdSchema } from "@noted/contracts";
import { readBoard, requireUser } from "@noted/server";

import { apiRoute } from "@/features/api/route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ homeId: string; boardId: string }> };

export async function GET(request: Request, context: Context) {
  return apiRoute(async () => {
    const user = await requireUser(request);
    const params = await context.params;
    const homeId = homeIdSchema.parse(params.homeId);
    const boardId = boardIdSchema.parse(params.boardId);
    return readBoard(user, homeId, boardId);
  });
}
