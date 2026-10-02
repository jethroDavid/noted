import "server-only";
import {
  BucketAlreadyExists,
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mediaEnv } from "./env";
import { isDeletableKey } from "./keys";

// Upload tickets live 15 minutes: long enough for a slow connection to
// start its PUT, short enough that a leaked ticket is useless quickly.
const PUT_URL_TTL_SECONDS = 900;

// Read URLs live an hour — far above the 60s board-cache TTL, so cached
// reads never serve dead URLs. Revocation is enforced at read time (a
// refetch rechecks membership), not by URL expiry.
const GET_URL_TTL_SECONDS = 3600;

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    const env = mediaEnv();
    client = new S3Client({
      endpoint: env.endpoint,
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
      // MinIO requires path style; AWS S3 accepts it too, so one setting
      // serves local development and production unchanged.
      forcePathStyle: true,
    });
  }
  return client;
}

let ensuredBucket: string | undefined;

// Buckets are not created by compose or CI: the first use brings its own.
// Memoized per process; concurrent first calls converge (create on an
// existing bucket succeeds for its owner).
export async function ensureBucket(): Promise<void> {
  const { bucket } = mediaEnv();
  if (ensuredBucket === bucket) return;
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3().send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (
        error instanceof BucketAlreadyExists ||
        error instanceof BucketAlreadyOwnedByYou
      ) {
        ensuredBucket = bucket;
        return;
      }
      throw error;
    }
  }
  ensuredBucket = bucket;
}

export interface UploadTicket {
  key: string;
  url: string;
}

// The presigned PUT binds content type and byte size, so the ticket is
// good for exactly the upload the server approved — no type or size swap.
export async function presignPut(
  key: string,
  contentType: string,
  byteSize: number,
): Promise<UploadTicket> {
  await ensureBucket();
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: mediaEnv().bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: byteSize,
    }),
    { expiresIn: PUT_URL_TTL_SECONDS },
  );
  return { key, url };
}

export async function presignGet(key: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: mediaEnv().bucket, Key: key }),
    { expiresIn: GET_URL_TTL_SECONDS },
  );
}

// Reads serve fixture blobs from /public and uploads via fresh presigned
// GETs. Callers check membership first — this mints no auth of its own.
export async function viewUrl(key: string): Promise<string> {
  if (key.startsWith("fixtures/")) return `/${key}`;
  return presignGet(key);
}

// Workers distinguish a deleted source (stop, no retry) from a transient
// outage (throw, QStash retries) through this predicate.
export function isMissingKey(error: unknown): boolean {
  // HeadObject reports NotFound; GetObject reports NoSuchKey.
  return error instanceof NotFound || error instanceof NoSuchKey;
}

// Confirm-time verification: an asset flips to attached only once its
// bytes are there. Fail-closed — an S3 outage fails the confirm, loudly.
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3().send(
      new HeadObjectCommand({ Bucket: mediaEnv().bucket, Key: key }),
    );
    return true;
  } catch (error) {
    if (error instanceof NotFound) return false;
    throw error;
  }
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: mediaEnv().bucket, Key: key }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty S3 object: ${key}`);
  return Buffer.from(bytes);
}

export async function putObjectBytes(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  await s3().send(
    new PutObjectCommand({
      Bucket: mediaEnv().bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export interface CleanupOutcome {
  deleted: string[];
  skipped: string[];
}

// Removes upload blobs by key. Anything outside homes/ is skipped with a
// warning instead of deleted — fixtures share storage keys across homes
// and must survive any cleanup.
export async function deleteUploadBlobs(
  keys: string[],
): Promise<CleanupOutcome> {
  const skipped = keys.filter((key) => !isDeletableKey(key));
  if (skipped.length > 0) {
    console.warn(`Skipping non-upload keys in cleanup: ${skipped.join(", ")}`);
  }
  const deletable = keys.filter(isDeletableKey);
  if (deletable.length === 0) return { deleted: [], skipped };
  const response = await s3().send(
    new DeleteObjectsCommand({
      Bucket: mediaEnv().bucket,
      Delete: { Objects: deletable.map((Key) => ({ Key })) },
    }),
  );
  if (response.Errors && response.Errors.length > 0) {
    const detail = response.Errors.map(
      (entry) => `${entry.Key}: ${entry.Message}`,
    ).join("; ");
    throw new Error(`Blob cleanup partially failed: ${detail}`);
  }
  return { deleted: deletable, skipped };
}
