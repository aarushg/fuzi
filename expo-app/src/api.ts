import Constants from "expo-constants";
import { Platform } from "react-native";

type ApiOptions = RequestInit & { token?: string };

const configuredUrl =
  process.env.EXPO_PUBLIC_FUZI_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "http://127.0.0.1:5000";

export const apiBaseUrl =
  Platform.OS === "android" && configuredUrl.includes("127.0.0.1")
    ? configuredUrl.replace("127.0.0.1", "10.0.2.2")
    : configuredUrl;

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
