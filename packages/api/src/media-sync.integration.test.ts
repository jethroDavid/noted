import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as schema from "@noted/db/src";
import { deleteUploadBlobs, objectExists } from "@noted/media/src";
import type { MediaOperation } from "@noted/validators/sync";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleCleanupMedia } from "./services/media";
import {
  applyMediaOperation,
  nativeConfirmUpload,
  nativeUploadTicket,
} from "./services/media-sync";
import type * as MediaWorkModule from "./services/media-work";
import { reconcileMediaWork } from "./services/media-work";

vi.mock("./services/events", () => ({
  boardChanged: vi.fn(async () => {}),
  mediaChanged: vi.fn(async () => {}),
}));
vi.mock("./services/media-work", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaWorkModule>()),
  dispatchMediaWork: vi.fn(async () => ({ dispatched: 0 })),
}));
const testUrl = process.env.NOTED_SYNC_TEST_DATABASE_URL;
const alice = {
  id: randomUUID(),
  email: "alice@sync.test",
  displayName: "Alice",
};
const bob = { id: randomUUID(), email: "bob@sync.test", displayName: "Bob" };
const outsider = {
  id: randomUUID(),
  email: "other@sync.test",
  displayName: "Other",
};
const homeId = randomUUID();
const boardId = randomUUID();
let pool: Pool;
let administrator: Pool;
let database: typeof schema.db;
const databaseName = `noted_sync_test_${randomUUID().replaceAll("-", "")}`;

const blob = Buffer.from("offline media verification");
function create(): Extract<MediaOperation, { kind: "create-photo" }> {
  return {
    kind: "create-photo",
    operationId: randomUUID(),
    homeId,
    boardId,
    itemId: randomUUID(),
    assetId: randomUUID(),
    x: 0.2,
    y: 0.3,
    upload: {
      homeId,
      kind: "photo",
      contentType: "image/png",
      byteSize: blob.length,
      checksum: createHash("sha256").update(blob).digest("base64"),
    },
  };
}
describe.skipIf(!testUrl)("PostgreSQL/S3 offline media protocol", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !url.pathname.startsWith("/noted_sync_test")
    )
      throw new Error(
        "Sync tests require an explicitly named local test database URL.",
      );
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    administrator = new Pool({ connectionString: adminUrl.href });
    await administrator.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.href });
    database = drizzle(pool, { schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("../../db/drizzle", import.meta.url),
      ),
    });
    await database.insert(schema.users).values(
      [alice, bob, outsider].map((user) => ({
        ...user,
        authSubject: user.id,
      })),
    );
    await database
      .insert(schema.homes)
      .values({ id: homeId, creatorUserId: alice.id, name: "Test home" });
    await database
      .insert(schema.boards)
      .values({ id: boardId, homeId, kind: "fridge" });
    await database
      .insert(schema.homeMemberships)
      .values([alice, bob].map((user) => ({ homeId, userId: user.id })));
  }, 30_000);

  afterAll(async () => {
    if (database) {
      const assets = await database.select().from(schema.mediaAssets);
      await deleteUploadBlobs(assets.map((a) => a.storageKey));
    }
    await pool?.end();
    if (administrator) {
      if (!/^noted_sync_test_[a-f0-9]{32}$/.test(databaseName))
        throw new Error("Unexpected test database name.");
      await administrator.query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
      await administrator.end();
    }
  });

  it("serializes duplicate creates and rejects reused identities", async () => {
    const op = create();
    expect(
      await Promise.all([
        applyMediaOperation(alice, op, database),
        applyMediaOperation(alice, op, database),
      ]),
    ).toEqual([
      { code: "ACCEPTED", revision: 1 },
      { code: "ACCEPTED", revision: 1 },
    ]);
    expect(
      await database
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, op.assetId)),
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, op.itemId)),
    ).toHaveLength(1);
    expect(
      (await applyMediaOperation(alice, { ...op, x: 0.9 }, database)).code,
    ).toBe("INVALID_OPERATION");
    expect(
      (
        await applyMediaOperation(
          bob,
          { ...op, operationId: randomUUID(), itemId: randomUUID() },
          database,
        )
      ).code,
    ).toBe("INVALID_OPERATION");
  });

  it("verifies original bytes once and commits durable work before publication", async () => {
    const op = create();
    await applyMediaOperation(alice, op, database);
    const ticket = await nativeUploadTicket(
      alice,
      homeId,
      op.assetId,
      database,
    );
    expect(ticket.code).toBe("UPLOAD");
    if (ticket.code !== "UPLOAD") throw Error("Missing upload ticket");
    const response = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": op.upload.contentType,
        "x-amz-checksum-sha256": op.upload.checksum,
      },
      body: blob,
    });
    expect(response.status).toBe(200);
    expect(
      await nativeConfirmUpload(alice, homeId, op.assetId, database),
    ).toEqual({ code: "VERIFIED" });
    const [first] = await database
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, op.assetId));
    expect(
      await nativeConfirmUpload(alice, homeId, op.assetId, database),
    ).toEqual({ code: "VERIFIED" });
    expect(
      await nativeUploadTicket(alice, homeId, op.assetId, database),
    ).toEqual({ code: "VERIFIED" });
    const [second] = await database
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, op.assetId));
    expect(second?.verifiedAt).toEqual(first?.verifiedAt);
    const work = await database
      .select()
      .from(schema.mediaWork)
      .where(eq(schema.mediaWork.assetId, op.assetId));
    expect(work).toHaveLength(1);
    expect(work[0]?.completedAt).toBeNull();
    const { dispatchMediaWork: dispatch } = await vi.importActual<
      typeof MediaWorkModule
    >("./services/media-work");
    await dispatch(database, async () => ({ delivered: false, via: "dev" }));
    const [failed] = await database
      .select()
      .from(schema.mediaWork)
      .where(eq(schema.mediaWork.assetId, op.assetId));
    expect(failed).toMatchObject({
      attempts: 1,
      lastError: "QUEUE_UNAVAILABLE",
      completedAt: null,
    });
  });

  it("preserves an unverified asset when confirmation cannot find the original", async () => {
    const op = create();
    await applyMediaOperation(alice, op, database);
    await expect(
      nativeConfirmUpload(alice, homeId, op.assetId, database),
    ).rejects.toThrow("Original bytes");
    expect(
      (
        await database
          .select()
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, op.assetId))
      )[0]?.state,
    ).toBe("pending");
    expect(
      await database
        .select()
        .from(schema.mediaWork)
        .where(eq(schema.mediaWork.assetId, op.assetId)),
    ).toHaveLength(0);
    expect(
      await nativeUploadTicket(outsider, homeId, op.assetId, database),
    ).toEqual({ code: "ACCESS_REVOKED" });
    await expect(
      nativeUploadTicket(bob, homeId, op.assetId, database),
    ).rejects.toThrow();
  });

  it("guards archive revisions and retains tombstones through restore and repeated removal", async () => {
    const op = create();
    await applyMediaOperation(alice, op, database);
    await applyMediaOperation(
      bob,
      {
        kind: "move-photo",
        homeId,
        boardId,
        itemId: op.itemId,
        operationId: randomUUID(),
        x: 0.7,
        y: 0.4,
      },
      database,
    );
    const stale = {
      kind: "archive-photo" as const,
      homeId,
      itemId: op.itemId,
      operationId: randomUUID(),
      expectedRevision: 1,
    };
    expect(await applyMediaOperation(alice, stale, database)).toEqual({
      code: "DELETE_REQUIRES_CONFIRMATION",
      revision: 2,
    });
    const archive = {
      ...stale,
      operationId: randomUUID(),
      expectedRevision: 2,
    };
    expect(await applyMediaOperation(alice, archive, database)).toEqual({
      code: "ACCEPTED",
      revision: 3,
    });
    expect(
      (
        await database
          .select()
          .from(schema.posts)
          .where(eq(schema.posts.id, op.itemId))
      )[0]?.deletedAt,
    ).not.toBeNull();
    expect(
      await database
        .select()
        .from(schema.bookEntries)
        .where(eq(schema.bookEntries.id, op.itemId)),
    ).toHaveLength(1);
    expect(await applyMediaOperation(alice, archive, database)).toEqual({
      code: "ACCEPTED",
      revision: 3,
    });
    const restoredId = randomUUID();
    expect(
      await applyMediaOperation(
        alice,
        {
          kind: "restore-photo",
          operationId: randomUUID(),
          homeId,
          boardId,
          itemId: restoredId,
          archivedItemId: op.itemId,
          expectedRevision: 1,
          x: 0.2,
          y: 0.3,
        },
        database,
      ),
    ).toEqual({ code: "ACCEPTED", revision: 1 });
    expect(
      (
        await database
          .select()
          .from(schema.posts)
          .where(eq(schema.posts.id, op.itemId))
      )[0]?.deletedAt,
    ).not.toBeNull();
    expect(
      (
        await database
          .select()
          .from(schema.bookEntries)
          .where(eq(schema.bookEntries.id, op.itemId))
      )[0]?.deletedAt,
    ).not.toBeNull();
  });

  it("does not clean referenced bytes or let a duplicate cleanup complete a newer intent", async () => {
    const op = create();
    await applyMediaOperation(alice, op, database);
    const ticket = await nativeUploadTicket(
      alice,
      homeId,
      op.assetId,
      database,
    );
    if (ticket.code !== "UPLOAD") throw Error("Missing upload ticket");
    await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": op.upload.contentType,
        "x-amz-checksum-sha256": op.upload.checksum,
      },
      body: blob,
    });
    await nativeConfirmUpload(alice, homeId, op.assetId, database);
    const [asset] = await database
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, op.assetId));
    await database
      .update(schema.mediaAssets)
      .set({ cleanupAfter: new Date(Date.now() - 1000) })
      .where(eq(schema.mediaAssets.id, op.assetId));
    await handleCleanupMedia(
      {
        job: "cleanup-media",
        homeId,
        assetId: op.assetId,
        keys: [asset!.storageKey],
      },
      database,
    );
    expect(await objectExists(asset!.storageKey)).toBe(true);
    expect(
      (
        await database
          .select()
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, op.assetId))
      )[0]?.cleanupAfter,
    ).toBeNull();
    await applyMediaOperation(
      alice,
      {
        kind: "archive-photo",
        operationId: randomUUID(),
        homeId,
        itemId: op.itemId,
        expectedRevision: 1,
      },
      database,
    );
    await applyMediaOperation(
      alice,
      {
        kind: "delete-book",
        operationId: randomUUID(),
        homeId,
        itemId: op.itemId,
        expectedRevision: 1,
      },
      database,
    );
    const [work] = await database
      .select()
      .from(schema.mediaWork)
      .where(
        and(
          eq(schema.mediaWork.assetId, op.assetId),
          eq(schema.mediaWork.kind, "cleanup-media"),
        ),
      );
    expect(work?.availableAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * 60_000,
    );
    await handleCleanupMedia(
      {
        job: "cleanup-media",
        homeId,
        assetId: op.assetId,
        keys: [asset!.storageKey],
        workId: work!.id,
      },
      database,
    );
    expect(await objectExists(asset!.storageKey)).toBe(true);
    await database
      .update(schema.mediaAssets)
      .set({ cleanupAfter: new Date(Date.now() - 1000) })
      .where(eq(schema.mediaAssets.id, op.assetId));
    await handleCleanupMedia(
      {
        job: "cleanup-media",
        homeId,
        assetId: op.assetId,
        keys: [asset!.storageKey],
        workId: work!.id,
      },
      database,
    );
    expect(await objectExists(asset!.storageKey)).toBe(false);
    expect(
      (
        await database
          .select()
          .from(schema.mediaWork)
          .where(eq(schema.mediaWork.id, work!.id))
      )[0]?.completedAt,
    ).not.toBeNull();
  });

  it("reclaims an orphan even when a full batch of older originals is protected", async () => {
    const ids: string[] = Array.from({ length: 100 }, () => randomUUID());
    const orphan = randomUUID();
    const old = new Date(Date.now() - 48 * 3600_000);
    await database.insert(schema.mediaAssets).values(
      [...ids, orphan].map((id) => ({
        id,
        homeId,
        kind: "photo" as const,
        state: "pending" as const,
        storageKey: `uploads/${homeId}/${id}.png`,
        contentType: "image/png",
        byteSize: blob.length,
        uploaderUserId: alice.id,
        uploadChecksum: create().upload.checksum,
        createdAt: old,
      })),
    );
    await database.insert(schema.posts).values(
      ids.map((id) => ({
        id: randomUUID(),
        boardId,
        kind: "photo" as const,
        mediaAssetId: id,
        creatorUserId: alice.id,
        positionX: 0.5,
        positionY: 0.5,
      })),
    );
    await reconcileMediaWork(database, async () => ({
      delivered: false,
      via: "dev",
    }));
    const [reclaimed] = await database
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, orphan));
    expect(reclaimed?.state).toBe("expired");
    const protectedRows = await database
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.state, "pending"));
    expect(protectedRows.filter((row) => ids.includes(row.id))).toHaveLength(
      100,
    );
    const intents = await database
      .select()
      .from(schema.mediaWork)
      .where(eq(schema.mediaWork.assetId, orphan));
    expect(intents.some((row) => row.kind === "cleanup-media")).toBe(true);
  });
});
