import "server-only";
import { boardsRouter } from "./routers/boards";
import { helloRouter } from "./routers/hello";
import { homesRouter } from "./routers/homes";
import { meRouter } from "./routers/me";
import { mediaRouter } from "./routers/media";
import { router } from "./trpc";

export const appRouter = router({
  hello: helloRouter,
  me: meRouter,
  homes: homesRouter,
  boards: boardsRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
