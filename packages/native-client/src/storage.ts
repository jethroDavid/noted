"use client";

import type { LocalStorageAdapter } from "@powersync/common";

export interface NativeMediaStorage extends LocalStorageAdapter {
  displayUri?(uri: string): Promise<string>;
  upload?(
    uri: string,
    url: string,
    headers: Record<string, string>,
  ): Promise<void>;
  download?(uri: string, url: string, expectedBytes: number): Promise<void>;
  usage(): Promise<number>;
  files(): Promise<{ uri: string; modified: number }[]>;
}
type Directory = FileSystemDirectoryHandle & {
  entries(): AsyncIterable<[string, FileSystemHandle]>;
};
export function createBrowserMediaStorage(scope: string): NativeMediaStorage {
  const root = `media/${scope}`;
  const parts = (uri: string) => {
    if (!uri.startsWith(`${root}/`) || uri.includes(".."))
      throw Error("Invalid account media path.");
    return uri.split("/");
  };
  const folder = async (path: string[], create = false) => {
    let dir = await navigator.storage.getDirectory();
    for (const name of path)
      dir = await dir.getDirectoryHandle(name, { create });
    return dir;
  };
  const file = async (uri: string, create = false) => {
    const names = parts(uri),
      name = names.pop()!;
    return (await folder(names, create)).getFileHandle(name, { create });
  };
  const usage = async (dir: Directory): Promise<number> => {
    let total = 0;
    for await (const [, handle] of dir.entries()) {
      if (handle.kind === "file")
        total += (await (handle as FileSystemFileHandle).getFile()).size;
      else total += await usage(handle as Directory);
    }
    return total;
  };
  return {
    async initialize() {
      await folder(root.split("/"), true);
    },
    getLocalUri: (name) => {
      const uri = `${root}/${name}`;
      parts(uri);
      return uri;
    },
    async saveFile(uri, data) {
      if (typeof data === "string") throw Error("Expected binary media.");
      const target = await file(uri, true),
        writer = await target.createWritable();
      try {
        await writer.write(data);
        await writer.close();
      } catch (error) {
        await writer.abort().catch(() => {});
        throw error;
      }
      return (await target.getFile()).size;
    },
    async readFile(uri) {
      return (await (await file(uri)).getFile()).arrayBuffer();
    },
    async deleteFile(uri) {
      const names = parts(uri),
        name = names.pop()!;
      try {
        await (await folder(names)).removeEntry(name);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError"))
          throw error;
      }
    },
    async fileExists(uri) {
      try {
        await file(uri);
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError")
          return false;
        throw error;
      }
    },
    async makeDir(uri) {
      await folder(parts(uri), true);
    },
    async rmDir(uri) {
      const names = parts(uri),
        name = names.pop()!;
      await (await folder(names)).removeEntry(name, { recursive: true });
    },
    async clear() {
      const names = root.split("/"),
        name = names.pop()!;
      await (await folder(names)).removeEntry(name, { recursive: true });
      await this.initialize();
    },
    async usage() {
      try {
        return await usage((await folder(["media"])) as Directory);
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError")
          return 0;
        throw error;
      }
    },
    async files() {
      const result: { uri: string; modified: number }[] = [];
      for await (const [name, handle] of (
        (await folder(root.split("/"), true)) as Directory
      ).entries()) {
        if (handle.kind === "file")
          result.push({
            uri: `${root}/${name}`,
            modified: (await (handle as FileSystemFileHandle).getFile())
              .lastModified,
          });
      }
      return result;
    },
  };
}
