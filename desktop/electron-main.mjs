import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, protocol, shell } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const webDistDir = path.join(rootDir, "expo-app", "dist");
const webIndexFile = path.join(webDistDir, "index.html");
const defaultApiUrl = "http://127.0.0.1:5000";
const desktopProtocol = "fuzi";

protocol.registerSchemesAsPrivileged([
  {
    scheme: desktopProtocol,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function readDesktopConfig() {
  const candidates = [
    process.env.FUZI_DESKTOP_CONFIG,
    path.join(app.getPath("userData"), "fuzi-desktop.config.json"),
    path.join(rootDir, "fuzi-desktop.config.json")
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function apiUrl() {
  const config = readDesktopConfig();
  return String(process.env.FUZI_API_URL || config.apiUrl || defaultApiUrl).replace(/\/+$/, "");
}

function portalCachePath() {
  const cacheDir = path.join(app.getPath("userData"), "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "portal-data-cache.json");
}

function localDataDir() {
  const dataDir = path.join(app.getPath("userData"), "local-data");
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function safeLocalDataName(value) {
  return String(value || "data").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "data";
}

function writeLocalDataMirror(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : null;
  if (!data) return;
  const dataDir = localDataDir();
  const manifest = {
    schemaVersion: payload.schemaVersion,
    tokenKey: payload.tokenKey,
    savedAt: payload.savedAt,
    collections: []
  };
  for (const [key, value] of Object.entries(data)) {
    if (["viewer", "access", "synced_at"].includes(key)) continue;
    if (!Array.isArray(value) && (!value || typeof value !== "object")) continue;
    const fileName = `${safeLocalDataName(key)}.json`;
    fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(value, null, 2), "utf8");
    manifest.collections.push({ key, file: fileName, records: Array.isArray(value) ? value.length : null });
  }
  fs.writeFileSync(path.join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

function offlineQueuePath() {
  const cacheDir = path.join(app.getPath("userData"), "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "offline-write-queue.json");
}

function readOfflineQueue() {
  try {
    const filePath = offlineQueuePath();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue) {
  fs.writeFileSync(offlineQueuePath(), JSON.stringify(queue), "utf8");
}

function registerCacheHandlers() {
  ipcMain.handle("fuzi-cache:read", async () => {
    try {
      const filePath = portalCachePath();
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return null;
    }
  });

  ipcMain.handle("fuzi-cache:write", async (_event, payload) => {
    fs.writeFileSync(portalCachePath(), JSON.stringify(payload), "utf8");
    writeLocalDataMirror(payload);
    return { ok: true };
  });

  ipcMain.handle("fuzi-cache:clear", async () => {
    try {
      const filePath = portalCachePath();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // A failed cache clear should not block logout.
    }
    return { ok: true };
  });

  ipcMain.handle("fuzi-offline-queue:list", async () => readOfflineQueue());

  ipcMain.handle("fuzi-offline-queue:enqueue", async (_event, item) => {
    const queue = readOfflineQueue();
    queue.push(item);
    writeOfflineQueue(queue);
    return { ok: true, count: queue.length };
  });

  ipcMain.handle("fuzi-offline-queue:replace", async (_event, queue) => {
    writeOfflineQueue(Array.isArray(queue) ? queue : []);
    return { ok: true, count: Array.isArray(queue) ? queue.length : 0 };
  });

  ipcMain.handle("fuzi-offline-queue:clear", async () => {
    writeOfflineQueue([]);
    return { ok: true };
  });
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  }[extension] || "application/octet-stream";
}

function resolveDesktopAsset(urlString) {
  const url = new URL(urlString);
  const decodedPath = decodeURIComponent(url.pathname || "/");
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const resolvedPath = path.resolve(webDistDir, `.${requestedPath}`);
  if (!resolvedPath.startsWith(webDistDir)) return "";
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) return resolvedPath;
  return webIndexFile;
}

function registerDesktopProtocol() {
  protocol.handle(desktopProtocol, async (request) => {
    const filePath = resolveDesktopAsset(request.url);
    if (!filePath || !fs.existsSync(filePath)) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    return new Response(fs.readFileSync(filePath), {
      headers: {
        "Cache-Control": path.extname(filePath).toLowerCase() === ".html" ? "no-store" : "public, max-age=31536000, immutable",
        "Content-Type": contentTypeFor(filePath)
      }
    });
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "FUZI Portal",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (!fs.existsSync(webIndexFile)) {
    throw new Error("Missing expo-app/dist/index.html. Run `npm run web:export` before starting Electron.");
  }

  mainWindow.loadURL(`${desktopProtocol}://app/index.html?apiUrl=${encodeURIComponent(apiUrl())}`);
}

app.whenReady().then(() => {
  registerCacheHandlers();
  registerDesktopProtocol();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
