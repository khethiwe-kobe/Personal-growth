"use client";

import { applyTool } from "./apply";
import { sanitizeHistory } from "./history";
import { getState, setState, uid, longDate, today } from "../store";
import { CONTEXT_PREFIX, PROFILE_LABELS, type ChatContent, type CoachEvent, type CoachState } from "../types";

/** Roughly when to condense the transcript (characters of serialised history). */
const COMPACT_AT_CHARS = 300_000;

export class PasscodeError extends Error {}

function snapshot(state: CoachState): string {
  const lines: string[] = [];
  const prof = Object.entries(state.profile);
  if (prof.length) {
    lines.push("Profile:");
    for (const [k, v] of prof) lines.push(`- ${PROFILE_LABELS[k] ?? k}: ${String(v)}`);
  }
  if (state.programme) {
    lines.push(
      `Programme: ${state.programme.title}. Weekly schedule: ${state.programme.schedule
        .map((d) => `${d.day} ${d.session} (${d.duration_min} min)`)
        .join("; ")}.`,
    );
  }
  if (state.metrics.length) {
    lines.push("Metrics (latest per test):");
    const latest = new Map<string, CoachState["metrics"][number]>();
    for (const m of state.metrics) latest.set(m.key, m);
    for (const m of latest.values()) lines.push(`- ${m.label}: ${m.value} ${m.unit} on ${m.date}`);
  }
  if (state.logs.length) {
    lines.push("Recent sessions:");
    for (const w of state.logs.slice(0, 6)) {
      lines.push(
        `- ${w.date} ${w.session}${w.completed ? "" : " (incomplete)"}: ${w.exercises
          .map((e) => [e.name, e.sets && e.reps ? `${e.sets}x${e.reps}` : e.reps, e.load].filter(Boolean).join(" "))
          .join("; ")}`,
      );
    }
  }
  return lines.join("\n");
}

function buildUserTurn(state: CoachState, text: string): ChatContent {
  const ctx = [`Today is ${longDate()} (${today()}).`];
  if (state.pendingSummary) {
    ctx.push("Summary of the coaching conversation so far (your own notes):\n" + state.pendingSummary);
  }
  if (state.stateVersion !== state.lastSnapshotVersion || state.pendingSummary) {
    const snap = snapshot(state);
    if (snap) ctx.push("Current tracked data on the athlete's dashboard:\n" + snap);
  }
  return {
    role: "user",
    parts: [{ text: `${CONTEXT_PREFIX}\n${ctx.join("\n\n")}\n</context>` }, { text }],
  };
}

async function post(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, passcode: getState().settings.passcode }),
    signal,
  });
  if (res.status === 401) {
    // Stored passcode no longer works (changed on the server): ask again.
    setState((s) => ({ ...s, settings: { ...s.settings, passcode: "" } }));
    throw new PasscodeError("Enter the passcode to use the coach.");
  }
  return res;
}

/** Replace the transcript with a coach-written summary that rides along with the next message. */
export async function compactNow(): Promise<string> {
  const state = getState();
  if (state.history.length === 0) return "";
  const res = await post("/api/compact", { history: state.history });
  const data = (await res.json()) as { summary?: string; error?: string };
  if (!res.ok || typeof data.summary !== "string") throw new Error(data.error ?? "Could not condense the conversation.");
  const summary = data.summary;
  setState((s) => ({
    ...s,
    history: [],
    pendingSummary: [s.pendingSummary, summary].filter(Boolean).join("\n\n"),
    stateVersion: s.stateVersion + 1,
  }));
  return summary;
}

export type SendHandlers = {
  onText: (delta: string) => void;
  onError: (message: string) => void;
  /** `kept` is false when the message was not recorded and should be restored to the input. */
  onDone: (kept: boolean) => void;
};

const hasCall = (c: ChatContent | undefined) => !!c?.parts.some((p) => p.functionCall);
const hasResponse = (c: ChatContent | undefined) => !!c?.parts.some((p) => p.functionResponse);

/**
 * Send one message to the coach. The transcript is append-only: the user turn
 * is added first, then each model turn and tool-response turn as the server
 * relays them. If a reply fails part way, incomplete tail turns are removed.
 */
export async function sendToCoach(text: string, handlers: SendHandlers, signal?: AbortSignal): Promise<void> {
  if (JSON.stringify(getState().history).length > COMPACT_AT_CHARS) {
    try {
      await compactNow();
    } catch (e) {
      if (e instanceof PasscodeError) {
        handlers.onError(e.message);
        handlers.onDone(false);
        return;
      }
      // Not fatal: carry on with the full transcript.
    }
  }

  const before = getState();
  const restore = { summary: before.pendingSummary, snapshotVersion: before.lastSnapshotVersion };
  const turn = buildUserTurn(before, text);
  setState((s) => ({
    ...s,
    history: [...s.history, turn],
    lastSnapshotVersion: s.stateVersion,
    pendingSummary: undefined,
  }));

  let res: Response;
  try {
    res = await post("/api/coach", { history: getState().history }, signal);
  } catch (e) {
    rollback(turn, restore);
    handlers.onError(e instanceof PasscodeError ? e.message : e instanceof Error && e.name === "AbortError" ? "Stopped." : "Network error.");
    handlers.onDone(false);
    return;
  }

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON error body.
    }
    rollback(turn, restore);
    handlers.onError(message);
    handlers.onDone(false);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (e: CoachEvent) => {
    switch (e.type) {
      case "text":
        handlers.onText(e.text);
        break;
      case "tool":
        setState((s) => applyTool(s, e.name, e.input, uid));
        break;
      case "model":
        setState((s) => ({ ...s, history: [...s.history, { role: "model", parts: e.parts }] }));
        break;
      case "tool_responses":
        setState((s) => ({ ...s, history: [...s.history, { role: "user", parts: e.parts }] }));
        break;
      case "error":
        handlers.onError(e.message);
        break;
      case "done":
        break;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handle(JSON.parse(line) as CoachEvent);
      }
    }
    if (buffer.trim()) handle(JSON.parse(buffer) as CoachEvent);
  } catch (e) {
    handlers.onError(e instanceof Error && e.name === "AbortError" ? "Stopped." : "The connection dropped.");
  }
  handlers.onDone(!rollback(turn, restore));
}

/**
 * Remove whatever a failed reply left incomplete. Returns true when the
 * user's own message was removed (nothing was recorded for it).
 */
function rollback(turn: ChatContent, restore: { summary?: string; snapshotVersion: number }): boolean {
  let droppedTurn = false;
  setState((s) => {
    let h = s.history;
    let changedData = false;
    // A tool round whose follow-up reply never arrived: the saves were applied
    // locally, so drop the round and let the next message carry a snapshot.
    if (h.length && h[h.length - 1].role === "user" && hasResponse(h[h.length - 1])) {
      h = h.slice(0, -1);
      changedData = true;
    }
    const last = h[h.length - 1];
    if (last && last.role === "model" && hasCall(last)) {
      const kept = last.parts.filter((p) => !p.functionCall);
      h = kept.length ? [...h.slice(0, -1), { ...last, parts: kept }] : h.slice(0, -1);
      changedData = true;
    }
    if (h[h.length - 1] === turn) {
      h = h.slice(0, -1);
      droppedTurn = true;
    }
    if (h === s.history) return s;
    return {
      ...s,
      history: sanitizeHistory(h),
      stateVersion: changedData ? s.stateVersion + 1 : s.stateVersion,
      // If the message itself was dropped, the next one must carry what it carried.
      lastSnapshotVersion: droppedTurn ? restore.snapshotVersion : s.lastSnapshotVersion,
      pendingSummary: droppedTurn ? restore.summary : s.pendingSummary,
    };
  });
  return droppedTurn;
}
