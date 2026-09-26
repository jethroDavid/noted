import { boardsRouter } from "./routers/boards";
import { helloRouter } from "./routers/hello";
import { homesRouter } from "./routers/homes";
import { meRouter } from "./routers/me";
import { router } from "./trpc";

export const appRouter = router({
  hello: helloRouter,
  me: meRouter,
  homes: homesRouter,
  boards: boardsRouter,
});

export type AppRouter = typeof appRouter;
