import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as schema from "@noted/db/src";
import type { NoteOperation } from "@noted/validators/sync";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyNoteOperation } from "./services/sync";

vi.mock("./services/events", () => ({ boardChanged: vi.fn() }));

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

function create(): Extract<NoteOperation, { kind: "create" }> {
  return {
    kind: "create",
    homeId,
    boardId,
    operationId: randomUUID(),
    postId: randomUUID(),
    value: {
      text: "Original",
      foregroundColor: "#123456",
      backgroundColor: "#ffe890",
      x: 0.2,
      y: 0.3,
    },
  };
}

function edit(operation: NoteOperation, text: string): NoteOperation {
  return {
    kind: "edit",
    homeId,
    boardId,
    postId: operation.postId,
    operationId: randomUUID(),
    patch: { text },
  };
}

describe.skipIf(!testUrl)("PostgreSQL offline note protocol", () => {
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

  it("commits a note, revision history, and receipt together", async () => {
    const operation = create();
    expect(await applyNoteOperation(alice, operation, database)).toEqual({
      code: "ACCEPTED",
      revision: 1,
    });
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toMatchObject([{ textContent: "Original", revision: 1 }]);
    expect(
      await database
        .select()
        .from(schema.noteRevisions)
        .where(eq(schema.noteRevisions.postId, operation.postId)),
    ).toMatchObject([{ text: "Original", revision: 1 }]);
    expect(
      await database
        .select()
        .from(schema.syncReceipts)
        .where(eq(schema.syncReceipts.operationId, operation.operationId)),
    ).toHaveLength(1);
  });

  it("deduplicates simultaneous delivery of the same create", async () => {
    const operation = create();
    const results = await Promise.all([
      applyNoteOperation(alice, operation, database),
      applyNoteOperation(alice, operation, database),
    ]);
    expect(results).toEqual([
      { code: "ACCEPTED", revision: 1 },
      { code: "ACCEPTED", revision: 1 },
    ]);
    expect(
      await database
        .select()
        .from(schema.noteRevisions)
        .where(eq(schema.noteRevisions.postId, operation.postId)),
    ).toHaveLength(1);
  });

  it("does not replay an old edit over a newer user's text after a lost response", async () => {
    const operation = create();
    await applyNoteOperation(alice, operation, database);
    const firstEdit = edit(operation, "Alice's edit");
    await applyNoteOperation(alice, firstEdit, database); // Drop this response.
    await applyNoteOperation(
      bob,
      edit(operation, "Bob's newer edit"),
      database,
    );
    expect(await applyNoteOperation(alice, firstEdit, database)).toEqual({
      code: "ACCEPTED",
      revision: 2,
    });
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toMatchObject([{ textContent: "Bob's newer edit", revision: 3 }]);
    expect(
      await database
        .select()
        .from(schema.noteRevisions)
        .where(eq(schema.noteRevisions.postId, operation.postId)),
    ).toHaveLength(3);
  });

  it("preserves both a text patch and a simultaneous move", async () => {
    const operation = create();
    await applyNoteOperation(alice, operation, database);
    await Promise.all([
      applyNoteOperation(alice, edit(operation, "Changed text"), database),
      applyNoteOperation(
        bob,
        {
          kind: "move",
          homeId,
          boardId,
          postId: operation.postId,
          operationId: randomUUID(),
          x: 0.7,
          y: 0.8,
        },
        database,
      ),
    ]);
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toMatchObject([
      {
        textContent: "Changed text",
        positionX: 0.7,
        positionY: 0.8,
        revision: 3,
      },
    ]);
  });

  it("guards stale deletes, deduplicates deletion, and never resurrects tombstoned IDs", async () => {
    const operation = create();
    await applyNoteOperation(alice, operation, database);
    await applyNoteOperation(bob, edit(operation, "Newer text"), database);
    const deletion: NoteOperation = {
      kind: "delete",
      homeId,
      boardId,
      postId: operation.postId,
      operationId: randomUUID(),
      expectedRevision: 1,
    };
    expect(await applyNoteOperation(alice, deletion, database)).toEqual({
      code: "DELETE_REQUIRES_CONFIRMATION",
      revision: 2,
    });
    const confirmed = {
      ...deletion,
      operationId: randomUUID(),
      expectedRevision: 2,
    };
    expect(await applyNoteOperation(alice, confirmed, database)).toEqual({
      code: "ACCEPTED",
      revision: 3,
    });
    expect(
      await applyNoteOperation(
        alice,
        { ...confirmed, operationId: randomUUID() },
        database,
      ),
    ).toEqual({ code: "ACCEPTED", revision: 3 });
    expect(
      await applyNoteOperation(
        bob,
        edit(operation, "Must not return"),
        database,
      ),
    ).toEqual({ code: "ITEM_DELETED" });
    expect(
      await applyNoteOperation(
        alice,
        { ...operation, operationId: randomUUID() },
        database,
      ),
    ).toMatchObject({ code: "INVALID_OPERATION" });
  });

  it("rejects changed payloads that reuse an operation ID", async () => {
    const operation = create();
    await applyNoteOperation(alice, operation, database);
    expect(
      await applyNoteOperation(
        alice,
        { ...operation, value: { ...operation.value, text: "Different" } },
        database,
      ),
    ).toMatchObject({ code: "INVALID_OPERATION" });
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toMatchObject([{ textContent: "Original" }]);
  });

  it("enforces membership even when an accepted receipt already exists", async () => {
    const operation = create();
    await applyNoteOperation(bob, operation, database);
    await database
      .delete(schema.homeMemberships)
      .where(
        and(
          eq(schema.homeMemberships.userId, bob.id),
          eq(schema.homeMemberships.homeId, homeId),
        ),
      );
    try {
      expect(await applyNoteOperation(bob, operation, database)).toEqual({
        code: "ACCESS_REVOKED",
      });
      expect(await applyNoteOperation(outsider, create(), database)).toEqual({
        code: "ACCESS_REVOKED",
      });
    } finally {
      await database
        .insert(schema.homeMemberships)
        .values({ userId: bob.id, homeId });
    }
  });

  it("does not allow an authorized home to be paired with another home's board", async () => {
    const operation = { ...create(), boardId: randomUUID() };
    expect(await applyNoteOperation(alice, operation, database)).toMatchObject({
      code: "INVALID_OPERATION",
    });
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toEqual([]);
  });

  it("rolls back the content and receipt if history persistence fails", async () => {
    const operation = create();
    await applyNoteOperation(alice, operation, database);
    // Inject a future conflicting revision to force history insertion to fail.
    await database.insert(schema.noteRevisions).values({
      postId: operation.postId,
      revision: 2,
      userId: alice.id,
      operationId: randomUUID(),
      text: "Injected failure",
      foregroundColor: "#123456",
      backgroundColor: "#ffe890",
    });
    const change = edit(operation, "Must roll back");
    await expect(applyNoteOperation(alice, change, database)).rejects.toThrow();
    expect(
      await database
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, operation.postId)),
    ).toMatchObject([{ textContent: "Original", revision: 1 }]);
    expect(
      await database
        .select()
        .from(schema.syncReceipts)
        .where(eq(schema.syncReceipts.operationId, change.operationId)),
    ).toEqual([]);
  });
});
