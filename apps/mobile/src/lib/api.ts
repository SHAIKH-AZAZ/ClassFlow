import { supabase } from "./supabase";

declare const process: { env: Record<string, string | undefined> };

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not set. Update apps/mobile/.env.");
  }
  const headers = new Headers(options.headers);
  for (const [k, v] of Object.entries(await authHeaders())) headers.set(k, v);
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body ? (body as { error?: string }).error : null;
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return body as T;
}
