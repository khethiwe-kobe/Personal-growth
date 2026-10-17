import { normalizeHistory } from "./coach/history";
import { EMPTY_STATE, type CoachState, type PublicProgress } from "./types";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Fill defaults, drop unknown fields and upgrade transcripts saved by earlier versions. */
export function hydrateState(raw: unknown): CoachState {
  const p = obj(raw);
  const phase = ["assessment", "analysis", "programme", "training"].includes(p.phase as string) ? (p.phase as CoachState["phase"]) : "assessment";
  return {
    version: 1,
    phase,
    profile: obj(p.profile) as CoachState["profile"],
    programme: (p.programme && typeof p.programme === "object" ? p.programme : null) as CoachState["programme"],
    logs: Array.isArray(p.logs) ? (p.logs as CoachState["logs"]) : [],
    metrics: Array.isArray(p.metrics) ? (p.metrics as CoachState["metrics"]) : [],
    history: normalizeHistory(p.history),
    ...(typeof p.pendingSummary === "string" && p.pendingSummary ? { pendingSummary: p.pendingSummary } : {}),
    stateVersion: typeof p.stateVersion === "number" ? p.stateVersion : 0,
    lastSnapshotVersion: typeof p.lastSnapshotVersion === "number" ? p.lastSnapshotVersion : 0,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : EMPTY_STATE.createdAt,
  };
}

/** What the group can see versus what stays between the member and their coach. */
export function splitState(s: CoachState): { priv: Omit<CoachState, keyof PublicProgress>; pub: PublicProgress } {
  const { programme, logs, metrics, ...priv } = s;
  return { priv, pub: { programme, logs, metrics } };
}

export function joinState(priv: unknown, pub: unknown): CoachState {
  return hydrateState({ ...obj(priv), ...obj(pub) });
}

/** True when there is nothing worth keeping (used to import a device's old local data once). */
export function isEmptyState(s: CoachState): boolean {
  return !s.history.length && !s.logs.length && !s.metrics.length && !s.programme && !Object.keys(s.profile).length;
}
