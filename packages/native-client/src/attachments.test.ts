import {
  mkdtemp,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  createNoteConnector,
  localMe,
  offlineSchema,
  saveMediaOperation,
  saveNoteOperation,
} from "@noted/offline/src";
import { NodeFileSystemAdapter, PowerSyncDatabase } from "@powersync/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAttachments, nativeTransferCode } from "./attachments";
import { createSceneClient } from "./scene-client";
import type { nativeApi } from "./session";
import type { NativeMediaStorage } from "./storage";

const homeId = crypto.randomUUID(),
  boardId = crypto.randomUUID();
const directories: string[] = [],
  databases: PowerSyncDatabase[] = [],
  managers: ReturnType<typeof createAttachments>[] = [];
function transport() {
  let verified = false,
    lostReply = false;
  const put = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", put);
  const client = {
    sync: {
      uploadTicket: {
        mutate: vi.fn(async () =>
          verified
            ? { code: "VERIFIED" }
            : { code: "UPLOAD", uploadUrl: "https://upload.invalid/original" },
        ),
      },
      confirmMedia: {
        mutate: vi.fn(async () => {
          verified = true;
          if (lostReply) {
            lostReply = false;
            throw Error("Acknowledgement lost");
          }
          return { code: "VERIFIED" };
        }),
      },
      mediaUrl: {
        query: vi.fn(async () => ({ url: "https://upload.invalid/original" })),
      },
    },
  };
  return {
    client: client as unknown as ReturnType<typeof nativeApi>,
    put,
    loseReply: () => {
      lostReply = true;
    },
  };
}
async function open(
  directory?: string,
  budget = 256 * 1024 * 1024,
  remote = transport(),
) {
  const location =
    directory ?? (await mkdtemp(join(tmpdir(), "noted-attachments-")));
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
  const files: NativeMediaStorage = Object.assign(
    new NodeFileSystemAdapter(join(location, "media")),
    {
      files: async () => {
        await files.initialize();
        return Promise.all(
          (await readdir(join(location, "media"))).map(async (name) => ({
            uri: files.getLocalUri(name),
            modified: (await stat(files.getLocalUri(name))).mtimeMs,
          })),
        );
      },
      usage: async () => {
        let size = 0;
        for (const file of await files.files())
          size += (await stat(file.uri)).size;
        return size;
      },
    },
  );
  const manager = createAttachments(
    database,
    files,
    remote.client,
    () => true,
    "https://api.invalid",
    budget,
  );
  managers.push(manager);
  await manager.initialize();
  const connector = createNoteConnector({
    isActive: () => true,
    fetchCredentials: async () => ({
      endpoint: "https://sync.invalid",
      token: "test",
    }),
    applyNote: async () => ({ code: "ACCEPTED", revision: 1 }),
    applyMedia: async () => ({ code: "ACCEPTED", revision: 1 }),
  });
  return { database, files, manager, location, remote, connector };
}
async function settleUpload(db: PowerSyncDatabase) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (
        await db.get<{ count: number }>(
          "SELECT count(*) AS count FROM attachments WHERE state=0 AND has_synced=0",
        )
      ).count === 0
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
afterEach(async () => {
  for (const manager of managers.splice(0)) {
    await manager.queue.stopSync();
    manager.release();
  }
  for (const database of databases.splice(0)) await database.close();
  for (const location of directories.splice(0)) {
    if (
      dirname(resolve(location)) !== resolve(tmpdir()) ||
      !basename(location).startsWith("noted-attachments-")
    )
      throw Error("Unexpected test directory");
    await rm(location, { recursive: true, force: true });
  }
  vi.unstubAllGlobals();
});
describe(
  "native original persistence and recovery",
  { timeout: 20_000 },
  () => {
    it("loads homes from SQLite while offline and hides revoked homes", async () => {
      const { database, remote } = await open();
      const creator = crypto.randomUUID();
      await database.execute(
        "INSERT INTO account_profile (id,email,display_name) VALUES (?,?,?)",
        [creator, "alice@example.com", "Alice"],
      );
      await database.execute(
        "INSERT INTO homes (id,name,creator_user_id) VALUES (?,?,?)",
        [homeId, "Offline home", creator],
      );
      await database.execute(
        "INSERT INTO boards (id,home_id,kind) VALUES (?,?,'fridge')",
        [boardId, homeId],
      );
      expect((await localMe(database)).homes).toMatchObject([
        { id: homeId, name: "Offline home", role: "creator" },
      ]);
      await database.execute("INSERT INTO revoked_homes (id) VALUES (?)", [
        homeId,
      ]);
      expect((await localMe(database)).homes).toEqual([]);
      expect(remote.put).not.toHaveBeenCalled();
    });
    it("keeps native failure diagnostics bounded and makes backoff retryable", async () => {
      expect(
        nativeTransferCode({
          code: "OS-PLUG-FLTR-0010",
          data: { httpStatus: 403, body: "private" },
          source: "signed-url",
        }),
      ).toBe("NATIVE_HTTP_403");
      expect(nativeTransferCode({ code: "private-token" })).toBe(
        "TRANSFER_FAILED",
      );
      const { database, manager } = await open();
      const id = crypto.randomUUID();
      await database.execute(
        "INSERT INTO media_failures (id,attempts,retry_at,code) VALUES (?,2,?,'NATIVE_HTTP_403')",
        [id, Date.now() + 3600000],
      );
      await manager.retry();
      expect(
        (
          await database.get<{ retry_at: number }>(
            "SELECT retry_at FROM media_failures WHERE id=?",
            [id],
          )
        ).retry_at,
      ).toBe(0);
    });
    it("requests visible originals using writes supported by PowerSync views", async () => {
      const { database, manager } = await open();
      const id = crypto.randomUUID();
      await manager.view(id, false);
      expect(
        await database.get(
          "SELECT visible,requested FROM media_views WHERE id=?",
          [id],
        ),
      ).toMatchObject({ visible: 0, requested: 0 });
      await manager.view(id, true);
      expect(
        await database.get(
          "SELECT visible,requested FROM media_views WHERE id=?",
          [id],
        ),
      ).toMatchObject({ visible: 1, requested: 1 });
      await database.execute("UPDATE media_views SET requested=0 WHERE id=?", [
        id,
      ]);
      await manager.view(id, false);
      expect(
        await database.get(
          "SELECT visible,requested FROM media_views WHERE id=?",
          [id],
        ),
      ).toMatchObject({ visible: 0, requested: 0 });
      await manager.view(id, true);
      expect(
        await database.get(
          "SELECT visible,requested FROM media_views WHERE id=?",
          [id],
        ),
      ).toMatchObject({ visible: 1, requested: 1 });
    });
    it("runs screen text operations through local SQLite without a network request", async () => {
      const ctx = await open();
      await ctx.database.execute(
        "INSERT INTO homes (id,name,creator_user_id) VALUES (?,?,?)",
        [homeId, "Local home", crypto.randomUUID()],
      );
      await ctx.database.execute(
        "INSERT INTO boards (id,home_id,kind,post_additions) VALUES (?,?,'fridge',0)",
        [boardId, homeId],
      );
      while (await ctx.database.getNextCrudTransaction())
        await (await ctx.database.getNextCrudTransaction())!.complete();
      const client = createSceneClient(
        {
          active: true,
          accountId: "alice",
          database: ctx.database,
          attachments: ctx.manager,
          pinHistory: async () => {},
          pause: async () => {},
          resume: () => {},
          retrySync: async () => {},
          close: async () => {},
        },
        "https://api.invalid",
        async () => "unused",
      );
      const created = await client.boards.createText.mutate({
        homeId,
        boardId,
        text: "Offline sketch",
        foregroundColor: "#123456",
        backgroundColor: "#ffe890",
        x: 0.2,
        y: 0.3,
      });
      await client.boards.editContent.mutate({
        homeId,
        postId: created.id,
        text: "Offline edit",
        foregroundColor: "#123456",
        backgroundColor: "#ffe890",
      });
      await client.boards.move.mutate({
        homeId,
        postId: created.id,
        x: 0.6,
        y: 0.4,
      });
      expect(
        (await client.boards.get.query({ homeId, boardId })).posts,
      ).toMatchObject([{ text: "Offline edit", x: 0.6, y: 0.4 }]);
      await client.boards.removePost.mutate({
        homeId,
        postId: created.id,
        expectedRevision: 1,
      });
      expect(
        (await client.boards.get.query({ homeId, boardId })).posts,
      ).toHaveLength(0);
      const restored = await client.boards.restorePost.mutate({
        homeId,
        boardId,
        postId: created.id,
        kind: "text",
        text: "Offline edit",
        foregroundColor: "#123456",
        backgroundColor: "#ffe890",
        x: 0.6,
        y: 0.4,
        createdAt: created.createdAt,
      });
      expect(restored.id).not.toBe(created.id);
      expect(
        (await client.boards.get.query({ homeId, boardId })).posts,
      ).toMatchObject([{ id: restored.id, text: "Offline edit" }]);
      expect(ctx.remote.put).not.toHaveBeenCalled();
      expect((await ctx.database.getUploadQueueStats()).count).toBe(5);
    });
    it("delegates original upload and playback to the native disk adapter", async () => {
      const ctx = await open();
      const upload = vi.fn(async () => {});
      const displayUri = vi.fn(
        async () => "https://localhost/_capacitor_file_/original.png",
      );
      ctx.files.upload = upload;
      ctx.files.displayUri = displayUri;
      await ctx.manager.save({
        homeId,
        boardId,
        file: new File(["original"], "photo.png", { type: "image/png" }),
      });
      await ctx.connector.uploadData(ctx.database);
      const read = vi
        .spyOn(ctx.files, "readFile")
        .mockRejectedValue(Error("Unexpected JavaScript buffering"));
      await ctx.manager.queue.startSync();
      await ctx.manager.queue.syncStorage();
      await settleUpload(ctx.database);
      const row = await ctx.database.get<{ id: string; local_uri: string }>(
        "SELECT id,local_uri FROM attachments",
      );
      expect(upload).toHaveBeenCalledWith(
        row.local_uri,
        "https://upload.invalid/original",
        expect.objectContaining({ "content-type": "image/png" }),
      );
      expect(await ctx.manager.localUrl(row.id, "image/png")).toBe(
        "https://localhost/_capacitor_file_/original.png",
      );
      expect(displayUri).toHaveBeenCalledWith(row.local_uri);
      expect(read).not.toHaveBeenCalled();
      expect(ctx.remote.put).not.toHaveBeenCalled();
    });
    it("delivers text metadata while an original confirmation is still in flight", async () => {
      const ctx = await open();
      let release: () => void = () => {};
      let entered: () => void = () => {};
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(
        ctx.remote.client.sync.confirmMedia,
        "mutate",
      ).mockImplementation(async () => {
        entered();
        await held;
        return { code: "VERIFIED" };
      });
      await ctx.manager.save({
        homeId,
        boardId,
        file: new File(["original"], "photo.png", { type: "image/png" }),
      });
      await ctx.connector.uploadData(ctx.database);
      await ctx.manager.queue.startSync();
      await started;
      await saveNoteOperation(ctx.database, {
        kind: "create",
        homeId,
        boardId,
        postId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        value: {
          text: "Not blocked by the photo",
          foregroundColor: "#123456",
          backgroundColor: "#ffe890",
          x: 0.2,
          y: 0.3,
        },
      });
      await ctx.connector.uploadData(ctx.database);
      expect((await ctx.database.getUploadQueueStats()).count).toBe(0);
      expect(await ctx.manager.pending()).toBe(1);
      release();
      await ctx.manager.queue.syncStorage();
      await settleUpload(ctx.database);
      expect(await ctx.manager.pending()).toBe(0);
    });
    it("reopens the original, its target and the same queued identity after restart", async () => {
      const first = await open();
      const original = new File([new Uint8Array([1, 2, 3, 4])], "photo.png", {
        type: "image/png",
      });
      await first.manager.save({
        homeId,
        boardId,
        file: original,
        x: 0.2,
        y: 0.3,
      });
      const before = await first.database.getNextCrudTransaction();
      expect(before?.crud).toHaveLength(2);
      const op = JSON.parse(before!.crud[0]!.metadata!);
      expect(JSON.parse(before!.crud[1]!.metadata!)).toEqual(op);
      await first.manager.queue.stopSync();
      await first.database.close();
      databases.splice(databases.indexOf(first.database), 1);
      const second = await open(first.location);
      const after = await second.database.getNextCrudTransaction();
      expect(JSON.parse(after!.crud[0]!.metadata!)).toEqual(op);
      expect(
        new Uint8Array(
          await second.files.readFile(
            second.files.getLocalUri(`${op.assetId}.png`),
          ),
        ),
      ).toEqual(new Uint8Array([1, 2, 3, 4]));
      expect(await second.manager.pending()).toBe(1);
      expect(
        await second.database.getOptional("SELECT id FROM posts WHERE id=?", [
          op.itemId,
        ]),
      ).toBeTruthy();
    });
    it("retries a lost confirmation without re-uploading or inventing a new asset", async () => {
      const remote = transport();
      remote.loseReply();
      const ctx = await open(undefined, 256 * 1024 * 1024, remote);
      await ctx.manager.save({
        homeId,
        boardId,
        file: new File(["original"], "photo.png", { type: "image/png" }),
      });
      await ctx.connector.uploadData(ctx.database);
      expect((await ctx.database.getUploadQueueStats()).count).toBe(0);
      await ctx.manager.queue.startSync();
      await ctx.manager.queue.syncStorage();
      expect(await ctx.manager.pending()).toBe(1);
      const [before] = await ctx.database.getAll<{ id: string }>(
        "SELECT id FROM attachments",
      );
      await ctx.database.execute("UPDATE media_failures SET retry_at=0");
      await ctx.manager.queue.syncStorage();
      await settleUpload(ctx.database);
      expect(await ctx.manager.pending()).toBe(0);
      expect(remote.put).toHaveBeenCalledTimes(1);
      expect(
        (
          await ctx.database.getAll<{ id: string }>(
            "SELECT id FROM attachments",
          )
        )[0]?.id,
      ).toBe(before!.id);
    });
    it("protects unsynced originals and pending targets, then evicts an accepted cache entry", async () => {
      const ctx = await open(undefined, 10);
      const original = new File(["12345678"], "photo.png", {
        type: "image/png",
      });
      await ctx.manager.save({ homeId, boardId, file: original });
      await expect(
        ctx.manager.save({ homeId, boardId, file: original }),
      ).rejects.toThrow("protected work");
      await ctx.connector.uploadData(ctx.database);
      await ctx.manager.queue.startSync();
      await ctx.manager.queue.syncStorage();
      await settleUpload(ctx.database);
      const op = await ctx.database.get<{ id: string; media_asset_id: string }>(
        "SELECT id,media_asset_id FROM posts",
      );
      await saveMediaOperation(ctx.database, {
        kind: "move-photo",
        operationId: crypto.randomUUID(),
        homeId,
        boardId,
        itemId: op.id,
        x: 0.4,
        y: 0.3,
      });
      await expect(
        ctx.manager.save({ homeId, boardId, file: original }),
      ).rejects.toThrow("protected work");
      await ctx.connector.uploadData(ctx.database);
      await ctx.manager.save({ homeId, boardId, file: original });
      expect(await ctx.files.usage()).toBe(8);
      expect(
        await ctx.files.fileExists(
          ctx.files.getLocalUri(`${op.media_asset_id}.png`),
        ),
      ).toBe(false);
    });
    it("purges a revoked home's original and its cached object URL", async () => {
      const ctx = await open();
      await ctx.manager.save({
        homeId,
        boardId,
        file: new File(["private"], "photo.png", { type: "image/png" }),
      });
      const row = await ctx.database.get<{ id: string }>(
        "SELECT id FROM attachments",
      );
      expect(await ctx.manager.localUrl(row.id, "image/png")).toMatch(/^blob:/);
      await ctx.database.execute(
        "INSERT INTO revoked_homes (id,notified) VALUES (?,0)",
        [homeId],
      );
      await ctx.manager.purgeRevoked();
      expect(await ctx.files.usage()).toBe(0);
      expect(
        await ctx.database.getAll("SELECT id FROM attachments"),
      ).toHaveLength(0);
      expect(await ctx.manager.localUrl(row.id, "image/png")).toBeNull();
    });
    it("only removes old unacknowledged file-copy orphans during startup", async () => {
      const ctx = await open();
      const old = ctx.files.getLocalUri("old-orphan.png"),
        recent = ctx.files.getLocalUri("recent-orphan.png");
      await writeFile(old, "old");
      await utimes(old, 0, 0);
      await writeFile(recent, "recent");
      await ctx.manager.initialize();
      expect(await ctx.files.fileExists(old)).toBe(false);
      expect(await ctx.files.fileExists(recent)).toBe(true);
    });
  },
);
