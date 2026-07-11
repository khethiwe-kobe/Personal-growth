"use client";

// Local-first persistence. Every piece of app state lives under a namespaced
// localStorage key and is exposed through the useStore hook, which keeps all
// components reading the same key in sync. The whole bundle can be exported,
// imported, or synced to Supabase (see lib/supabase.ts).

import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "pg:";

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function readKey<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  if (typeof window === "undefined") return fallback;
  let value = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    // corrupt entry: fall back silently
  }
  cache.set(key, value);
  return value;
}

export function writeKey<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full: state still lives in memory for this session
  }
  notify(key);
}

type Updater<T> = T | ((prev: T) => T);

export function useStore<T>(key: string, fallback: T): [T, (v: Updater<T>) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    [key]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSnapshot = useCallback(() => readKey(key, fallback), [key]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback(
    (v: Updater<T>) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(readKey(key, fallback)) : v;
      writeKey(key, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  return [value, set];
}

/** Export every app key as a single JSON bundle. */
export function exportBundle(): string {
  const bundle: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      try {
        bundle[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        // skip corrupt entries
      }
    }
  }
  return JSON.stringify({ app: "personal-growth", exportedAt: new Date().toISOString(), data: bundle }, null, 2);
}

/** Import a bundle produced by exportBundle, replacing existing keys. */
export function importBundle(json: string): number {
  const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
  const data = parsed.data;
  if (!data || typeof data !== "object") throw new Error("Not a valid backup file");
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    writeKey(key, value);
    count++;
  }
  return count;
}
