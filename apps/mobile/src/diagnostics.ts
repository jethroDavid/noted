"use client";

import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function exportNativeDiagnostics(json: string) {
  const result = await Filesystem.writeFile({
    path: "noted-sync-diagnostics.json",
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    data: json,
  });
  await Share.share({
    title: "Noted sync diagnostics",
    dialogTitle: "Export Noted diagnostics",
    files: [result.uri],
  });
}
