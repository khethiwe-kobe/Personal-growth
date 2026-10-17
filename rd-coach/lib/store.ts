"use client";

import { useSyncExternalStore } from "react";
import { hydrateState } from "./state";
import { EMPTY_STATE, type CoachState, type Member } from "./types";

/**
 * The signed-in member's data lives on the server. This store mirrors it so
 * pages render instantly, and keeps a per-member copy on the device so the
 * app opens with the last known data even before the network answers.
 */
export type Status = "loading" | "signed_out" | "ready" | "no_database";

type Snapshot = { status: Status; me: Member | null; state: CoachState };

const LEGACY_KEY = "rd-coach:v1";
const cacheKey = (id: string) => `rd-coach:cache:${id}`;

let snap: Snapshot = { status: "loading", me: null, state: EMPTY_STATE };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  if (!snap.me) return;
  try {
    localStorage.setItem(cacheKey(snap.me.id), JSON.stringify(snap.state));
  } catch {
    // Storage full or blocked: the server copy is what matters.
  }
}

export function getSnapshot(): Snapshot {
  return snap;
}

export function getState(): CoachState {
  return snap.state;
}

export function setState(update: (s: CoachState) => CoachState) {
  snap = { ...snap, state: update(snap.state) };
  persist();
  emit();
}

/** Replace local data with what the server returned. */
export function replaceState(next: unknown) {
  snap = { ...snap, state: hydrateState(next) };
  persist();
  emit();
}

export function setSession(status: Status, me: Member | null) {
  let state = snap.state;
  if (me && me.id !== snap.me?.id) {
    state = EMPTY_STATE;
    try {
      const cached = localStorage.getItem(cacheKey(me.id));
      if (cached) state = hydrateState(JSON.parse(cached));
    } catch {
      // Ignore a corrupt cache.
    }
  }
  if (!me) state = EMPTY_STATE;
  snap = { status, me, state };
  emit();
}

/** Data kept on this device by the first version, before accounts existed. */
export function legacyData(): unknown | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLegacyData() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing to do.
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const serverSnap: Snapshot = { status: "loading", me: null, state: EMPTY_STATE };

export function useSession(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnap);
}

export function useCoachState(): CoachState {
  return useSession().state;
}

export function useMe(): Member | null {
  return useSession().me;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
