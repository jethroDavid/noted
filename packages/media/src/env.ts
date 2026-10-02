import "server-only";
import { z } from "zod";

const mediaEnvSchema = z.object({
  endpoint: z.string().min(1),
  region: z.string().min(1),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

export type MediaEnv = z.infer<typeof mediaEnvSchema>;

let cached: MediaEnv | undefined;

// Local MinIO defaults: tests and dev work with zero config while compose
// is up. CI and production set S3_* explicitly. Empty strings are rejected
// (a set-but-empty variable is a misconfiguration, not a default).
export function mediaEnv(): MediaEnv {
  cached ??= parseEnv();
  return cached;
}

function parseEnv(): MediaEnv {
  const parsed = mediaEnvSchema.safeParse({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "noted-media",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "noted",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "notednoted",
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid media environment: ${issues}`);
  }
  return parsed.data;
}
