const { contextBridge, ipcRenderer } = require("electron");

const params = new URLSearchParams(globalThis.location?.search || "");
const apiUrl = String(process.env.FUZI_API_URL || params.get("apiUrl") || "").replace(/\/+$/, "");

contextBridge.exposeInMainWorld("FUZI_API_URL", apiUrl);

contextBridge.exposeInMainWorld("FUZI_DESKTOP_CACHE", {
  read: () => ipcRenderer.invoke("fuzi-cache:read"),
  write: (payload) => ipcRenderer.invoke("fuzi-cache:write", payload),
  clear: () => ipcRenderer.invoke("fuzi-cache:clear")
});

contextBridge.exposeInMainWorld("FUZI_OFFLINE_QUEUE", {
  list: () => ipcRenderer.invoke("fuzi-offline-queue:list"),
  enqueue: (item) => ipcRenderer.invoke("fuzi-offline-queue:enqueue", item),
  replace: (queue) => ipcRenderer.invoke("fuzi-offline-queue:replace", queue),
  clear: () => ipcRenderer.invoke("fuzi-offline-queue:clear")
});
