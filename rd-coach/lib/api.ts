"use client";

import { replaceState, setSession } from "./store";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** JSON request to the app's own API. A 401 signs the device out. */
export async function api<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init.headers } : init.headers;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (res.status === 401 && data.code === "signed_out") {
    setSession("signed_out", null);
  }
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status}).`, res.status);
  return data;
}

/** Fetch the member's latest data from the server into the store. */
export async function refreshState(): Promise<void> {
  const data = await api<{ state: unknown }>("/api/state");
  replaceState(data.state);
}
