import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, net, protocol, shell } from "electron";
import { isSignInNavigation, rendererAsset } from "./navigation.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "noted",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window?.isMinimized()) window.restore();
  window?.focus();
});

const rendererDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer",
);
const { apiUrl } = JSON.parse(
  readFileSync(resolve(rendererDirectory, "native-config.json"), "utf8"),
) as { apiUrl: string };

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Noted",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSignInNavigation(url, apiUrl)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    if (target.protocol !== "noted:" || target.hostname !== "app")
      event.preventDefault();
  });
  await window.loadURL("noted://app/index.html");
}

void app.whenReady().then(async () => {
  if (!primaryInstance) return;
  protocol.handle("noted", (request) => {
    const asset = rendererAsset(rendererDirectory, request.url);
    return asset ? net.fetch(asset) : new Response(null, { status: 404 });
  });
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
