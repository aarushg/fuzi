import Constants from "expo-constants";
import { Platform } from "react-native";

type ApiOptions = RequestInit & { token?: string };

const configuredUrl = process.env.EXPO_PUBLIC_FUZI_API_URL;
const configuredHost = process.env.EXPO_PUBLIC_FUZI_API_HOST;
const configuredPort = process.env.EXPO_PUBLIC_FUZI_API_PORT;
const configuredProtocol = process.env.EXPO_PUBLIC_FUZI_API_PROTOCOL || "http";
const fallbackUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) || "http://127.0.0.1:5000";

function buildApiUrl(): string {
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }
  if (configuredHost) {
    const port = configuredPort ? `:${configuredPort}` : "";
    return `${configuredProtocol}://${configuredHost}${port}`.replace(/\/+$/, "");
  }
  return fallbackUrl.replace(/\/+$/, "");
}

const resolvedUrl = buildApiUrl();

export const apiBaseUrl =
  Platform.OS === "android" && resolvedUrl.includes("127.0.0.1")
    ? resolvedUrl.replace("127.0.0.1", "10.0.2.2")
    : resolvedUrl;

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
