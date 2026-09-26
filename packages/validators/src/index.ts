import { z } from "zod";

export const helloInput = z.object({
  name: z.string().min(1).max(100).optional(),
});

export type HelloInput = z.infer<typeof helloInput>;
