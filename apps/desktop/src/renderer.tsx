"use client";

import {
  createBrowserMediaStorage,
  mountNativeApp,
  nativeConfiguration,
} from "@noted/native-client/src";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { createDesktopDatabase } from "./database";

mountNativeApp({
  auth: getAuth(initializeApp(nativeConfiguration.firebase)),
  configuration: nativeConfiguration,
  createDatabase: createDesktopDatabase,
  createStorage: createBrowserMediaStorage,
  openBrowser: async (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
});
