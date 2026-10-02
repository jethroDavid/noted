import "server-only";
import { z } from "zod";

export const processMediaJobSchema = z.object({
  job: z.literal("process-media"),
  homeId: z.uuid(),
  assetId: z.uuid(),
});

export const cleanupMediaJobSchema = z.object({
  job: z.literal("cleanup-media"),
  homeId: z.uuid(),
  assetId: z.uuid(),
  keys: z.array(z.string().min(1)).min(1),
});

export const jobEnvelopeSchema = z.discriminatedUnion("job", [
  processMediaJobSchema,
  cleanupMediaJobSchema,
]);

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
export type ProcessMediaJob = z.infer<typeof processMediaJobSchema>;
export type CleanupMediaJob = z.infer<typeof cleanupMediaJobSchema>;

// The single source for publisher URLs; the worker routes live at these
// paths. A new job adds one envelope variant above and one route here.
export const WORKER_ROUTES = {
  "process-media": "/api/workers/process-media",
  "cleanup-media": "/api/workers/cleanup-media",
} as const satisfies Record<JobEnvelope["job"], string>;
