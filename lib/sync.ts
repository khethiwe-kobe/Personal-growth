"use client";

// Automatic cloud sync. Once signed in, this loads any existing cloud backup
// onto the device, then saves every change back to the cloud (debounced) and
// pulls newer changes when the window regains focus — so "everything is stored"
// without pressing a button. Local-first still holds: with no connection the
// app keeps working and syncs when it can.

import { exportBundle, subscribeChanges } from "./storage";
import { applyCloudBundle, fetchCloudState, pushCloudState } from "./supabase";

export type SyncStatus = "idle" | "syncing" | "saving" | "synced" | "error";

// Stored OUTSIDE the "pg:" bundle so it is never itself synced.
const LOCAL_TS_KEY = "pg-sync-ts";

let active = false;
let unsub: (() => void) | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let statusCb: ((s: SyncStatus, detail?: string) => void) | null = null;
let focusHandler: (() => void) | null = null;

function setStatus(s: SyncStatus, detail?: string) {
  statusCb?.(s, detail);
}
function localTs(): number {
  return Number(localStorage.getItem(LOCAL_TS_KEY) || 0);
}
function setLocalTs(n: number) {
  localStorage.setItem(LOCAL_TS_KEY, String(n));
}
function localData(): Record<string, unknown> {
  try {
    return (JSON.parse(exportBundle()).data as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}
function hasKeys(obj: unknown): boolean {
  return !!obj && typeof obj === "object" && Object.keys(obj as object).length > 0;
}

async function pushNow() {
  setStatus("saving");
  let r: Awaited<ReturnType<typeof pushCloudState>>;
  try {
    r = await pushCloudState();
  } catch {
    setStatus("error", "Could not reach the cloud");
    return;
  }
  if ("error" in r) {
    setStatus("error", r.error);
    return;
  }
  setLocalTs(Date.parse(r.updatedAt));
  setStatus("synced", "Saved to cloud");
}

function schedulePush() {
  if (!active) return;
  setLocalTs(Date.now());
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(pushNow, 1500);
}

async function reconcile() {
  setStatus("syncing");
  let cloud: Awaited<ReturnType<typeof fetchCloudState>>;
  try {
    cloud = await fetchCloudState();
  } catch {
    setStatus("error", "Could not reach the cloud");
    return;
  }
  if (cloud && "error" in cloud) {
    setStatus("error", cloud.error);
    return;
  }
  if (cloud && hasKeys(cloud.data)) {
    // A cloud backup exists — load it onto this device.
    applyCloudBundle(cloud.data);
    setLocalTs(Date.parse(cloud.updatedAt));
    setStatus("synced", "Loaded from cloud");
  } else if (hasKeys(localData())) {
    // No cloud backup yet — save this device's data to start it.
    await pushNow();
  } else {
    setStatus("synced");
  }
}

async function pullIfNewer() {
  if (!active) return;
  const cloud = await fetchCloudState();
  if (!cloud || "error" in cloud) return;
  if (hasKeys(cloud.data) && Date.parse(cloud.updatedAt) > localTs()) {
    applyCloudBundle(cloud.data);
    setLocalTs(Date.parse(cloud.updatedAt));
    setStatus("synced", "Updated from cloud");
  }
}

/** Begin automatic sync for the signed-in user. */
export async function startSync(cb: (s: SyncStatus, detail?: string) => void) {
  statusCb = cb;
  if (active) return;
  active = true;
  unsub = subscribeChanges(schedulePush);
  focusHandler = () => void pullIfNewer();
  window.addEventListener("focus", focusHandler);
  await reconcile();
}

/** Stop automatic sync (e.g. on sign out). */
export function stopSync() {
  active = false;
  unsub?.();
  unsub = null;
  if (focusHandler) window.removeEventListener("focus", focusHandler);
  focusHandler = null;
  if (debounce) clearTimeout(debounce);
  setStatus("idle");
}

export function isSyncing(): boolean {
  return active;
}
