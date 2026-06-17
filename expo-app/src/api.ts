import Constants from "expo-constants";
import { Platform } from "react-native";

type ApiOptions = RequestInit & { token?: string };

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

function buildApiUrl(): string {
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

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`);
  }
  return data as T;
}
