"use client";

import { applyTool } from "./apply";
import { refreshState } from "../api";
import { setState, setSession, uid } from "../store";
import type { ChatContent, CoachEvent } from "../types";

export type SendHandlers = {
  onText: (delta: string) => void;
  /** Clear text shown so far: the coach is starting that reply again. */
  onReset: () => void;
  /** A short note about what the coach is doing right now. */
  onStatus: (text: string) => void;
  /** A message to show once the request is over. */
  onNotice: (message: string) => void;
  /** `kept` is false when the message was not recorded and should be put back in the input. */
  onDone: (kept: boolean) => void;
};

const SAVING: Record<string, string> = {
  update_profile: "Saving your details…",
  record_metric: "Recording your result…",
  save_programme: "Saving your programme…",
  log_workout: "Logging your session…",
  set_phase: "Updating your progress…",
};

/** True when the coach saved something and then never replied (the reply was cut off). */
export function needsFinishing(history: ChatContent[]): boolean {
  const last = history[history.length - 1];
  return !!last && last.role === "user" && last.parts.some((p) => p.functionResponse) && !last.parts.some((p) => p.text);
}

type Outcome = { result: "done" | "cut" | "failed"; kept: boolean; notice: string | null };

/** One request to the coach, streamed. "cut" means saves were made but the reply did not finish. */
async function streamCoach(body: Record<string, unknown>, handlers: SendHandlers, alreadyKept: boolean): Promise<Outcome> {
  let kept = alreadyKept;
  let notice: string | null = null;
  let finished = false;
  let failed = false;

  let res: Response;
  try {
    res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { result: kept ? "cut" : "failed", kept, notice: "You seem to be offline. Check your connection and try again." };
  }
  if (res.status === 401) {
    setSession("signed_out", null);
    return { result: "failed", kept, notice: null };
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { result: kept ? "cut" : "failed", kept, notice: data.error ?? "The coach could not be reached. Please try again." };
  }

  const handle = (e: CoachEvent) => {
    switch (e.type) {
      case "text":
        handlers.onText(e.text);
        break;
      case "reset":
        handlers.onReset();
        break;
      case "status":
        handlers.onStatus(e.text);
        break;
      case "tool":
        handlers.onStatus(SAVING[e.name] ?? "Saving…");
        setState((s) => applyTool(s, e.name, e.input, uid));
        break;
      case "model":
        kept = true;
        handlers.onReset();
        setState((s) => ({ ...s, history: [...s.history, { role: "model", parts: e.parts }] }));
        break;
      case "tool_responses":
        handlers.onStatus("Coach is thinking…");
        setState((s) => ({ ...s, history: [...s.history, { role: "user", parts: e.parts }] }));
        break;
      case "busy":
      case "error":
        notice = e.message;
        failed = true;
        break;
      case "done":
        finished = true;
        break;
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
  } catch {
    // The connection dropped; treated like a reply that ended early.
  }

  if (finished && !failed) return { result: "done", kept, notice: null };
  return { result: kept ? "cut" : "failed", kept, notice };
}

/**
 * Keep asking the coach to finish a reply that was cut off after a save.
 * Each attempt is a fresh request, so a server time limit cannot stop it.
 */
async function finishReplies(first: Outcome, handlers: SendHandlers): Promise<Outcome> {
  let out = first;
  for (let attempt = 0; out.result === "cut" && attempt < 3; attempt++) {
    handlers.onReset();
    handlers.onStatus("Finishing the coach's reply…");
    out = await streamCoach({ resume: true }, handlers, true);
  }
  return out;
}

async function settle(out: Outcome, handlers: SendHandlers) {
  try {
    await refreshState();
  } catch {
    // Keep what is shown; the next load will catch up.
  }
  if (out.result === "cut") {
    handlers.onNotice("Your update was saved, but the coach could not finish replying just now. Tap Finish reply to try again.");
  } else if (out.notice && out.result === "failed") {
    handlers.onNotice(out.notice);
  }
  handlers.onDone(out.kept);
}

/**
 * Send one message to the coach. The server records the conversation and
 * applies the coach's saves; the browser shows them as they stream in and
 * then re-reads the saved state.
 */
export async function sendToCoach(text: string, handlers: SendHandlers): Promise<void> {
  // Show the message straight away; the server's copy replaces it at the end.
  const optimistic: ChatContent = { role: "user", parts: [{ text }] };
  setState((s) => ({ ...s, history: [...s.history, optimistic] }));
  handlers.onStatus("Coach is thinking…");
  const out = await finishReplies(await streamCoach({ text }, handlers, false), handlers);
  if (!out.kept) setState((s) => ({ ...s, history: s.history.filter((c) => c !== optimistic) }));
  await settle(out, handlers);
}

/** Ask the coach to finish a reply that was cut off earlier. */
export async function finishReply(handlers: SendHandlers): Promise<void> {
  handlers.onStatus("Finishing the coach's reply…");
  const out = await finishReplies({ result: "cut", kept: true, notice: null }, handlers);
  await settle(out, handlers);
}
