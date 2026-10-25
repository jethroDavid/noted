import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { NoteOperation } from "@noted/validators/sync";
import { PowerSyncDatabase } from "@powersync/node";
import { afterEach, describe, expect, it } from "vitest";
import { createNoteConnector } from "./connector";
import { saveNoteOperation, visibleNotesSql } from "./notes";
import { accountDatabaseFilename, offlineSchema } from "./schema";

const databases: PowerSyncDatabase[] = [];
const directories: string[] = [];
const homeId = crypto.randomUUID();
const boardId = crypto.randomUUID();

function create(home = homeId): Extract<NoteOperation, { kind: "create" }> {
  return {
    kind: "create",
    operationId: crypto.randomUUID(),
    homeId: home,
    boardId,
    postId: crypto.randomUUID(),
    value: {
      text: "Saved while offline",
      foregroundColor: "#123456",
      backgroundColor: "#ffe890",
      x: 0.2,
      y: 0.3,
    },
  };
}

async function open(directory?: string) {
  const location =
    directory ?? (await mkdtemp(join(tmpdir(), "noted-offline-")));
  if (!directory) directories.push(location);
  const database = new PowerSyncDatabase({
    schema: offlineSchema,
    database: {
      dbFilename: "test.sqlite",
      dbLocation: location,
      readWorkerCount: 1,
    },
  });
  databases.push(database);
  await database.init();
  return { database, location };
}

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
  for (const directory of directories.splice(0)) {
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith("noted-offline-")
    )
      throw new Error("Unexpected test directory.");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("durable PowerSync note operations", { timeout: 20_000 }, () => {
  it("reopens locally saved text and the exact same queued operation", async () => {
    const { database, location } = await open();
    const operation = create();
    await saveNoteOperation(database, operation);
    await database.close();
    databases.splice(databases.indexOf(database), 1);
    const reopened = (await open(location)).database;
    expect(
      await reopened.getAll(visibleNotesSql, [boardId, homeId]),
    ).toMatchObject([
      { id: operation.postId, text_content: operation.value.text },
    ]);
    const transaction = await reopened.getNextCrudTransaction();
    expect(transaction?.crud).toHaveLength(1);
    expect(JSON.parse(transaction!.crud[0]!.metadata!)).toEqual(operation);
  });

  it("queues only the fields the edit changes and cannot overwrite a duplicate local ID", async () => {
    const { database } = await open();
    const operation = create();
    await saveNoteOperation(database, operation);
    await expect(
      saveNoteOperation(database, {
        ...operation,
        value: { ...operation.value, text: "Wrong duplicate" },
      }),
    ).rejects.toThrow("already exists");
    await (await database.getNextCrudTransaction())!.complete();
    await saveNoteOperation(database, {
      kind: "edit",
      operationId: crypto.randomUUID(),
      homeId,
      boardId,
      postId: operation.postId,
      patch: { text: "Changed text" },
    });
    const queued = (await database.getNextCrudTransaction())!.crud[0]!;
    expect(queued.opData?.text_content).toBe("Changed text");
    expect(queued.opData).not.toHaveProperty("position_x");
    expect(queued.opData).not.toHaveProperty("background_color");
  });

  it("retains work after a lost response and retries with its original operation ID", async () => {
    const { database } = await open();
    const operation = create();
    await saveNoteOperation(database, operation);
    const delivered: NoteOperation[] = [];
    const connector = createNoteConnector({
      isActive: () => true,
      fetchCredentials: async () => ({
        endpoint: "https://sync.example.com",
        token: "test",
      }),
      applyNote: async (item) => {
        delivered.push(item);
        if (delivered.length === 1) throw new Error("Lost response");
        return { code: "ACCEPTED", revision: 1 };
      },
    });
    await expect(connector.uploadData!(database)).rejects.toThrow(
      "Lost response",
    );
    expect((await database.getUploadQueueStats()).count).toBe(1);
    await connector.uploadData!(database);
    expect(delivered).toEqual([operation, operation]);
    expect((await database.getUploadQueueStats()).count).toBe(0);
  });

  it("persists rejected text before completing the queue, including across restart", async () => {
    const { database, location } = await open();
    const operation = create();
    await saveNoteOperation(database, operation);
    await (await database.getNextCrudTransaction())!.complete();
    const edit: NoteOperation = {
      kind: "edit",
      operationId: crypto.randomUUID(),
      homeId,
      boardId,
      postId: operation.postId,
      patch: { text: "Recover this text" },
    };
    await saveNoteOperation(database, edit);
    const connector = createNoteConnector({
      isActive: () => true,
      fetchCredentials: async () => ({
        endpoint: "https://sync.example.com",
        token: "test",
      }),
      applyNote: async () => ({ code: "ITEM_DELETED" }),
    });
    await connector.uploadData!(database);
    await database.close();
    databases.splice(databases.indexOf(database), 1);
    const reopened = (await open(location)).database;
    expect((await reopened.getUploadQueueStats()).count).toBe(0);
    const saved = await reopened.get<{ operation_json: string }>(
      "SELECT operation_json FROM note_outcomes WHERE id = ?",
      [edit.operationId],
    );
    expect(JSON.parse(saved.operation_json)).toEqual(edit);
  });

  it("discards queued revoked-home work without blocking another home or retaining recovery text", async () => {
    const { database } = await open();
    const first = create();
    await saveNoteOperation(database, first);
    await saveNoteOperation(database, {
      kind: "edit",
      operationId: crypto.randomUUID(),
      homeId,
      boardId,
      postId: first.postId,
      patch: { text: "No longer authorized" },
    });
    const otherHome = crypto.randomUUID();
    await saveNoteOperation(database, create(otherHome));
    const delivered: string[] = [];
    const connector = createNoteConnector({
      isActive: () => true,
      fetchCredentials: async () => ({
        endpoint: "https://sync.example.com",
        token: "test",
      }),
      applyNote: async (item) => {
        delivered.push(item.homeId);
        return item.homeId === homeId
          ? { code: "ACCESS_REVOKED" }
          : { code: "ACCEPTED", revision: 1 };
      },
    });
    while ((await database.getUploadQueueStats()).count)
      await connector.uploadData!(database);
    expect(delivered).toEqual([homeId, otherHome]);
    expect(await database.getAll(visibleNotesSql, [boardId, homeId])).toEqual(
      [],
    );
    expect(await database.getAll("SELECT * FROM note_outcomes")).toEqual([]);
    expect(await database.getAll("SELECT * FROM revoked_homes")).toMatchObject([
      { id: homeId, notified: 0 },
    ]);
  });

  it("does not deliver work after its account becomes inactive", async () => {
    const { database } = await open();
    await saveNoteOperation(database, create());
    const connector = createNoteConnector({
      isActive: () => false,
      fetchCredentials: async () => {
        throw new Error("must not run");
      },
      applyNote: async () => {
        throw new Error("must not run");
      },
    });
    await expect(connector.uploadData!(database)).rejects.toThrow("paused");
    expect((await database.getUploadQueueStats()).count).toBe(1);
  });

  it("uses stable separate filenames for accounts without using their raw IDs as paths", async () => {
    expect(await accountDatabaseFilename("alice/../../bad")).toMatch(
      /^noted-[a-f0-9]{64}\.sqlite$/,
    );
    expect(await accountDatabaseFilename("alice")).toBe(
      await accountDatabaseFilename("alice"),
    );
    expect(await accountDatabaseFilename("alice")).not.toBe(
      await accountDatabaseFilename("bob"),
    );
    await expect(accountDatabaseFilename("")).rejects.toThrow(
      "authenticated account",
    );
  });
});
