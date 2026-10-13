"use client";

import { applyTool } from "./apply";
import { refreshState } from "../api";
import { setState, setSession, uid } from "../store";
import type { ChatContent, CoachEvent } from "../types";

export type SendHandlers = {
  onText: (delta: string) => void;
  /** Clear text shown so far: the coach is starting that reply again. */
  onReset: () => void;
  /** A calm progress note, e.g. while the coach waits out a busy period. */
  onStatus: (text: string) => void;
  /** A message to show once the request is over. */
  onNotice: (message: string) => void;
  /** `kept` is false when the message was not recorded and should be put back in the input. */
  onDone: (kept: boolean) => void;
};

/**
 * Send one message to the coach. The server records the conversation and
 * applies the coach's saves; the browser shows them as they stream in and
 * then re-reads the saved state.
 */
export async function sendToCoach(text: string, handlers: SendHandlers, signal?: AbortSignal): Promise<void> {
  // Show the message straight away; the server's copy replaces it at the end.
  const optimistic: ChatContent = { role: "user", parts: [{ text }] };
  setState((s) => ({ ...s, history: [...s.history, optimistic] }));
  let kept = false;

  const finish = async () => {
    if (!kept) setState((s) => ({ ...s, history: s.history.filter((c) => c !== optimistic) }));
    try {
      await refreshState();
    } catch {
      // Keep what is shown; the next load will catch up.
    }
    handlers.onDone(kept);
  };

  let res: Response;
  try {
    res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      credentials: "same-origin",
      signal,
    });
  } catch (e) {
    handlers.onNotice(e instanceof Error && e.name === "AbortError" ? "Stopped." : "You seem to be offline. Your message is back in the box; send it when you are connected.");
    return finish();
  }

  if (res.status === 401) {
    setSession("signed_out", null);
    return finish();
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    handlers.onNotice(data.error ?? "The coach could not be reached. Please try again.");
    return finish();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
        setState((s) => applyTool(s, e.name, e.input, uid));
        break;
      case "model":
        kept = true;
        handlers.onReset();
        setState((s) => ({ ...s, history: [...s.history, { role: "model", parts: e.parts }] }));
        break;
      case "tool_responses":
        setState((s) => ({ ...s, history: [...s.history, { role: "user", parts: e.parts }] }));
        break;
      case "busy":
      case "error":
        handlers.onNotice(e.message);
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
    handlers.onNotice(
      e instanceof Error && e.name === "AbortError"
        ? "Stopped."
        : "The connection dropped. Anything the coach saved is kept; send your message again if the reply is missing.",
    );
  }
  return finish();
}
