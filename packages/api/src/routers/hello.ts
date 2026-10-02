import "server-only";
import { helloInput } from "@noted/validators/src";
import { publicProcedure, router } from "../trpc";

export const helloRouter = router({
  greet: publicProcedure.input(helloInput).query(({ input }) => {
    return `Hello, ${input.name ?? "world"}!`;
  }),
});
