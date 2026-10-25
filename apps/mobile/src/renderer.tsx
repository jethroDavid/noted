"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { mountNativeApp, nativeConfiguration } from "@noted/native-client/src";
import { offlineSchema } from "@noted/offline/src";
import { PowerSyncDatabase } from "@powersync/capacitor";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { exportNativeDiagnostics } from "./diagnostics";
import { createMobileStorage } from "./storage";

mountNativeApp({
  auth: getAuth(initializeApp(nativeConfiguration.firebase)),
  configuration: nativeConfiguration,
  createStorage: createMobileStorage,
  ...(Capacitor.isNativePlatform()
    ? { exportDiagnostics: exportNativeDiagnostics }
    : {}),
  createDatabase: (dbFilename) =>
    new PowerSyncDatabase({ schema: offlineSchema, database: { dbFilename } }),
  openBrowser: async (url) => {
    await Browser.open({ url });
  },
});
