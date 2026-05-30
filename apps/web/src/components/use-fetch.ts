"use client";

import { useCallback, useEffect, useState } from "react";

export function useApiFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadIndex, setReloadIndex] = useState(0);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(url, { credentials: "include" })
      .then(async (response) => {
        const json = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
        if (!response.ok) {
          throw new Error(json?.error ?? `Request failed: ${response.status}`);
        }
        return json;
      })
      .then((json) => {
        if (alive) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Request failed.");
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadIndex, ...deps]);

  return { data, error, loading, reload };
}

export async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const json = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed: ${response.status}`);
  }
  return json as T;
}

export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const json = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Upload failed: ${response.status}`);
  }
  return json as T;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString();
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleDateString();
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// PostgREST returns one-to-one joins as a single object when there's a unique
// constraint, but as an array otherwise. Normalize both into a single object.
export function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
