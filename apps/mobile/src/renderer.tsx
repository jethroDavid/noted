"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
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
  authReturnTo: Capacitor.isNativePlatform() ? "android" : undefined,
  closeBrowser: async () => {
    await Browser.close();
  },
  subscribeWakeup: (callback) => {
    const handles = [
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) callback();
      }),
      App.addListener("appUrlOpen", () => callback()),
      Network.addListener("networkStatusChange", ({ connected }) => {
        if (connected) callback();
      }),
    ];
    return () => {
      for (const handle of handles)
        void handle.then((listener) => listener.remove());
    };
  },
  openBrowser: async (url) => {
    await Browser.open({ url });
  },
});
