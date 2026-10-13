"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { applyTool } from "./apply";
import { getState, setState, uid, longDate, today } from "../store";
import { CONTEXT_PREFIX, PROFILE_LABELS, type CoachEvent, type CoachState } from "../types";

/** Roughly when to condense the transcript (characters of serialised history). */
const COMPACT_AT_CHARS = 350_000;

function snapshot(state: CoachState): string {
  const lines: string[] = [];
  const prof = Object.entries(state.profile);
  if (prof.length) {
    lines.push("Profile:");
    for (const [k, v] of prof) lines.push(`- ${PROFILE_LABELS[k] ?? k}: ${String(v)}`);
  }
  if (state.programme) {
    lines.push(`Programme: ${state.programme.title}. Weekly schedule: ${state.programme.schedule.map((d) => `${d.day} ${d.session} (${d.duration_min} min)`).join("; ")}.`);
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
      lines.push(`- ${w.date} ${w.session}${w.completed ? "" : " (incomplete)"}: ${w.exercises.map((e) => [e.name, e.sets && e.reps ? `${e.sets}x${e.reps}` : e.reps, e.load].filter(Boolean).join(" ")).join("; ")}`);
    }
  }
  return lines.join("\n");
}

function buildUserTurn(state: CoachState, text: string, extra: string[]): Anthropic.MessageParam {
  const ctx = [`Today is ${longDate()} (${today()}).`, ...extra];
  if (state.stateVersion !== state.lastSnapshotVersion) {
    ctx.push("The athlete edited their dashboard by hand. Current tracked data:\n" + snapshot(state));
  }
  return {
    role: "user",
    content: [
      { type: "text", text: `${CONTEXT_PREFIX}\n${ctx.join("\n\n")}\n</context>` },
      { type: "text", text },
    ],
  };
}

async function maybeCompact(apiKey: string): Promise<string | null> {
  const state = getState();
  const size = JSON.stringify(state.history).length;
  if (size < COMPACT_AT_CHARS) return null;
  return compactNow(apiKey);
}

/** Replace the transcript with a coach-written summary. Returns the summary. */
export async function compactNow(apiKey: string): Promise<string> {
  const state = getState();
  if (state.history.length === 0) return "";
  const res = await fetch("/api/compact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "x-coach-key": apiKey } : {}) },
    body: JSON.stringify({ history: state.history }),
  });
  const data = (await res.json()) as { summary?: string; error?: string };
  if (!res.ok || typeof data.summary !== "string") throw new Error(data.error ?? "Could not condense the conversation.");
  setState((s) => ({ ...s, history: [], stateVersion: s.stateVersion + 1 }));
  return data.summary;
}

export type SendHandlers = {
  onText: (delta: string) => void;
  onToolSaved: (name: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

/**
 * Send one message to the coach. The transcript in the store is append-only:
 * the user turn is appended first, then every assistant turn and tool-result
 * turn exactly as the API produced them.
 */
export async function sendToCoach(text: string, handlers: SendHandlers, signal?: AbortSignal): Promise<void> {
  const apiKey = getState().settings.apiKey;
  const extra: string[] = [];
  try {
    const summary = await maybeCompact(apiKey);
    if (summary) extra.push("Summary of the coaching conversation so far (your own notes):\n" + summary);
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : "Could not condense the conversation.");
  }

  const turn = buildUserTurn(getState(), text, extra);
  setState((s) => ({ ...s, history: [...s.history, turn], lastSnapshotVersion: s.stateVersion }));

  let res: Response;
  try {
    res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { "x-coach-key": apiKey } : {}) },
      body: JSON.stringify({ history: getState().history }),
      signal,
    });
  } catch (e) {
    handlers.onError(e instanceof Error && e.name === "AbortError" ? "Stopped." : "Network error.");
    handlers.onDone();
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
    handlers.onError(message);
    handlers.onDone();
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
        handlers.onToolSaved(e.name);
        break;
      case "assistant":
        setState((s) => ({ ...s, history: [...s.history, { role: "assistant", content: e.content }] }));
        break;
      case "tool_results":
        setState((s) => ({ ...s, history: [...s.history, { role: "user", content: e.content }] }));
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
  } finally {
    // If the stream died after the user turn was stored but before any
    // assistant turn, drop the dangling user turn so the next send is valid.
    setState((s) => {
      let history = s.history;
      const last = history[history.length - 1];
      if (last === turn) history = history.slice(0, -1);
      // Likewise an assistant turn whose tool calls never got their results.
      const tail = history[history.length - 1];
      if (
        tail &&
        tail.role === "assistant" &&
        Array.isArray(tail.content) &&
        tail.content.some((b) => b.type === "tool_use")
      ) {
        history = history.slice(0, -1);
      }
      return history === s.history ? s : { ...s, history };
    });
    handlers.onDone();
  }
}
