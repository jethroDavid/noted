import { app, BrowserWindow } from "electron";
import { resolveStartUrl } from "./start-url.js";

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Noted",
    // Defaults stay locked down (context isolation on, Node integration
    // off): the window only renders the remote app, like the mobile
    // webview. No preload until a native API needs exposing.
  });
  await window.loadURL(
    resolveStartUrl({
      packaged: app.isPackaged,
      appUrl: process.env.APP_URL,
      port: process.env.PORT,
    }),
  );
}

void app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
