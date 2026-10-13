"use client";

import { useSyncExternalStore } from "react";
import { normalizeHistory } from "./coach/history";
import { EMPTY_STATE, type CoachState } from "./types";

const KEY = "rd-coach:v1";
const listeners = new Set<() => void>();
let cache: CoachState | null = null;

function read(): CoachState {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      cache = hydrate(JSON.parse(raw));
      return cache;
    }
  } catch {
    // Corrupt or blocked storage: start fresh in memory.
  }
  cache = { ...EMPTY_STATE, createdAt: new Date().toISOString() };
  return cache;
}

/** Fill defaults and upgrade transcripts saved by earlier versions. */
export function hydrate(raw: unknown): CoachState {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<CoachState> & { settings?: { passcode?: unknown } };
  const passcode = typeof parsed.settings?.passcode === "string" ? parsed.settings.passcode : "";
  return { ...EMPTY_STATE, ...parsed, history: normalizeHistory(parsed.history), settings: { passcode } };
}

function write(next: CoachState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode: keep the in-memory copy.
  }
  listeners.forEach((l) => l());
}

export function getState(): CoachState {
  return read();
}

export function setState(update: (s: CoachState) => CoachState) {
  write(update(read()));
}

export function replaceState(next: unknown) {
  write(hydrate(next));
}

export function resetState() {
  // The passcode is about access to this deployment, not training data; keep it.
  const passcode = read().settings.passcode;
  write({ ...EMPTY_STATE, settings: { passcode }, createdAt: new Date().toISOString() });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCoachState(): CoachState {
  return useSyncExternalStore(subscribe, read, () => EMPTY_STATE);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
