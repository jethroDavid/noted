"use client";

import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { createBrowserMediaStorage } from "@noted/native-client/src";
import type { NativeMediaStorage } from "@noted/native-client/src";
import type { AttachmentData } from "@powersync/common";

export function createMobileStorage(scope: string): NativeMediaStorage {
  if (!Capacitor.isNativePlatform()) return createBrowserMediaStorage(scope);
  const root = `media/${scope}`;
  const path = (value: string) => {
    if (value.startsWith(`${root}/`) && !value.includes("..")) return value;
    throw Error("Invalid account media path.");
  };
  const mkdir = async (p: string) => {
    try {
      await Filesystem.mkdir({
        path: p,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      await Filesystem.stat({ path: p, directory: Directory.Data });
    }
  };
  return {
    async displayUri(uri) {
      const file = await Filesystem.getUri({
        path: path(uri),
        directory: Directory.Data,
      });
      return Capacitor.convertFileSrc(file.uri);
    },
    async upload(uri, url, headers) {
      const file = await Filesystem.getUri({
        path: path(uri),
        directory: Directory.Data,
      });
      await FileTransfer.uploadFile({
        url,
        path: file.uri,
        method: "PUT",
        chunkedMode: false,
        headers: Object.fromEntries(
          Object.entries(headers).map(([key, value]) => [
            key.toLowerCase() === "content-type" ? "Content-Type" : key,
            value,
          ]),
        ),
        shouldEncodeUrlParams: false,
      });
    },
    async download(uri, url, expectedBytes) {
      await mkdir(root);
      const temporary = path(`${uri}.partial`);
      const file = await Filesystem.getUri({
        path: temporary,
        directory: Directory.Data,
      });
      await FileTransfer.downloadFile({
        url,
        path: file.uri,
        shouldEncodeUrlParams: false,
      });
      const saved = await Filesystem.stat({
        path: temporary,
        directory: Directory.Data,
      });
      if (saved.size !== expectedBytes) {
        await Filesystem.deleteFile({
          path: temporary,
          directory: Directory.Data,
        });
        throw Error("Downloaded original size does not match its metadata.");
      }
      await Filesystem.rename({
        from: temporary,
        to: path(uri),
        directory: Directory.Data,
        toDirectory: Directory.Data,
      });
    },
    async initialize() {
      await mkdir(root);
    },
    getLocalUri: (filename) => path(`${root}/${filename}`),
    async saveFile(uri: string, data: AttachmentData) {
      await mkdir(root);
      if (typeof data === "string") throw Error("Binary media is required.");
      // Bound bridge payloads instead of building one giant base64 string.
      const bytes = new Uint8Array(data),
        chunkSize = 192 * 1024;
      await Filesystem.writeFile({
        path: path(uri),
        directory: Directory.Data,
        data: "",
        recursive: true,
      });
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        let binary = "";
        for (let n = 0; n < chunk.length; n += 8192)
          binary += String.fromCharCode(...chunk.subarray(n, n + 8192));
        await Filesystem.appendFile({
          path: path(uri),
          directory: Directory.Data,
          data: btoa(binary),
        });
      }
      const stat = await Filesystem.stat({
        path: path(uri),
        directory: Directory.Data,
      });
      if (stat.size !== bytes.length)
        throw Error("Media was not fully saved on this device.");
      return stat.size;
    },
    async readFile(uri) {
      const result = await Filesystem.readFile({
        path: path(uri),
        directory: Directory.Data,
      });
      if (result.data instanceof Blob) return result.data.arrayBuffer();
      const decoded = atob(result.data),
        bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return bytes.buffer;
    },
    async fileExists(uri) {
      try {
        await Filesystem.stat({ path: path(uri), directory: Directory.Data });
        return true;
      } catch {
        return false;
      }
    },
    async deleteFile(uri) {
      if (await this.fileExists(uri))
        await Filesystem.deleteFile({
          path: path(uri),
          directory: Directory.Data,
        });
    },
    async makeDir(p) {
      await mkdir(path(p));
    },
    async rmDir(p) {
      await Filesystem.rmdir({
        path: path(p),
        directory: Directory.Data,
        recursive: true,
      });
    },
    async clear() {
      await Filesystem.rmdir({
        path: root,
        directory: Directory.Data,
        recursive: true,
      });
      await mkdir(root);
    },
    async usage() {
      let total = 0;
      await mkdir(root);
      for (const account of (
        await Filesystem.readdir({ path: "media", directory: Directory.Data })
      ).files)
        for (const file of (
          await Filesystem.readdir({
            path: `media/${account.name}`,
            directory: Directory.Data,
          })
        ).files)
          total += file.size;
      return total;
    },
    async files() {
      await mkdir(root);
      return (
        await Filesystem.readdir({ path: root, directory: Directory.Data })
      ).files.map((file) => ({
        uri: `${root}/${file.name}`,
        modified: file.mtime,
      }));
    },
  };
}
