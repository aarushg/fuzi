import Constants from "expo-constants";
import { Platform } from "react-native";

type ApiOptions = RequestInit & { token?: string };
type OfflineQueueItem = {
  id: string;
  path: string;
  method: string;
  body?: BodyInit | null;
  headers: Record<string, string>;
  createdAt: string;
};
type DesktopOfflineQueue = {
  list: () => Promise<OfflineQueueItem[]>;
  enqueue: (item: OfflineQueueItem) => Promise<{ ok?: boolean; count?: number }>;
  replace: (queue: OfflineQueueItem[]) => Promise<{ ok?: boolean; count?: number }>;
  clear: () => Promise<{ ok?: boolean }>;
};

declare const __DEV__: boolean;

const configuredUrl = process.env.EXPO_PUBLIC_FUZI_API_URL;
const configuredHost = process.env.EXPO_PUBLIC_FUZI_API_HOST;
const configuredPort = process.env.EXPO_PUBLIC_FUZI_API_PORT;
const configuredProtocol = process.env.EXPO_PUBLIC_FUZI_API_PROTOCOL || "http";
const fallbackUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) || "";

function normalizeApiUrl(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.replace(/\/+$/, "");
}

function runtimeApiUrl(): string {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return "";
  const runtime = globalThis as typeof globalThis & { FUZI_API_URL?: string; location?: Location; localStorage?: Storage };
  const fromGlobal = normalizeApiUrl(runtime.FUZI_API_URL);
  if (fromGlobal) return fromGlobal;
  try {
    const fromStorage = normalizeApiUrl(runtime.localStorage?.getItem("fuzi_api_url") || undefined);
    if (fromStorage) return fromStorage;
  } catch {
    // Browser storage can be unavailable in locked-down desktop shells.
  }
  try {
    const params = new URLSearchParams(runtime.location?.search || "");
    return normalizeApiUrl(params.get("apiUrl") || undefined);
  } catch {
    return "";
  }
}

function buildApiUrl(): string {
  const runtimeUrl = runtimeApiUrl();
  if (runtimeUrl) return runtimeUrl;
  if (configuredUrl !== undefined) {
    return normalizeApiUrl(configuredUrl);
  }
  if (configuredHost) {
    const port = configuredPort ? `:${configuredPort}` : "";
    return normalizeApiUrl(`${configuredProtocol}://${configuredHost}${port}`);
  }
  if (Platform.OS === "web" && typeof globalThis.location !== "undefined") {
    const { protocol, hostname, port } = globalThis.location;
    if (__DEV__ && ["8081", "8082", "19006"].includes(port)) {
      return normalizeApiUrl(`${protocol}//${hostname}:5000`);
    }
    return "";
  }
  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }
  return normalizeApiUrl(fallbackUrl);
}

const resolvedUrl = buildApiUrl();

export const apiBaseUrl = resolvedUrl;

function desktopOfflineQueue(): DesktopOfflineQueue | null {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return null;
  const runtime = globalThis as typeof globalThis & { FUZI_OFFLINE_QUEUE?: DesktopOfflineQueue };
  return runtime.FUZI_OFFLINE_QUEUE || null;
}

function methodFor(options: ApiOptions) {
  return String(options.method || "GET").toUpperCase();
}

function shouldQueueOffline(path: string, options: ApiOptions) {
  const method = methodFor(options);
  if (method === "GET" || method === "HEAD") return false;
  if (path.includes("/auth/login") || path.includes("/auth/logout")) return false;
  return Boolean(desktopOfflineQueue());
}

async function enqueueOfflineWrite(path: string, method: string, headers: Headers, body: BodyInit | null | undefined) {
  const queue = desktopOfflineQueue();
  if (!queue) return;
  await queue.enqueue({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    path,
    method,
    body,
    headers: Object.fromEntries(headers.entries()),
    createdAt: new Date().toISOString(),
  });
}

async function fetchApi(path: string, options: RequestInit, headers: Headers) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  const method = methodFor(options);

  let response: Response;
  try {
    response = await fetchApi(path, { ...options, method }, headers);
  } catch (error) {
    if (shouldQueueOffline(path, { ...options, method })) {
      await enqueueOfflineWrite(path, method, headers, options.body);
      return { ok: true, queued_offline: true, message: "Saved offline. This change will sync when the server is reachable." } as T;
    }
    throw error;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`);
  }
  return data as T;
}

export async function syncQueuedOfflineWrites() {
  const queue = desktopOfflineQueue();
  if (!queue) return { ok: true, synced: 0, remaining: 0 };
  const pending = await queue.list();
  if (!pending.length) return { ok: true, synced: 0, remaining: 0 };
  let synced = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    const headers = new Headers(item.headers);
    try {
      const response = await fetchApi(item.path, {
        method: item.method,
        body: item.body ?? undefined,
      }, headers);
      if (!response.ok) {
        const remaining = pending.slice(index);
        await queue.replace(remaining);
        return { ok: false, synced, remaining: remaining.length };
      }
      synced += 1;
    } catch {
      const remaining = pending.slice(index);
      await queue.replace(remaining);
      return { ok: false, synced, remaining: remaining.length };
    }
  }
  await queue.clear();
  return { ok: true, synced, remaining: 0 };
}

export async function clearQueuedOfflineWrites() {
  const queue = desktopOfflineQueue();
  if (!queue) return;
  await queue.clear();
}
