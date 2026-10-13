"use client";

import { useRef, useState } from "react";
import { Page } from "@/components/Page";
import { compactNow } from "@/lib/coach/client";
import { getState, replaceState, resetState, setState, useCoachState } from "@/lib/store";
import type { CoachState } from "@/lib/types";

export default function SettingsPage() {
  const state = useCoachState();
  const [key, setKey] = useState(state.settings.apiKey);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const saveKey = () => {
    setState((s) => ({ ...s, settings: { ...s.settings, apiKey: key.trim() } }));
    setNotice("Key saved in this browser.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rd-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<CoachState>;
      if (parsed.version !== 1 || !Array.isArray(parsed.history)) throw new Error("Not an RD Coach backup.");
      if (!window.confirm("Replace everything in this browser with the backup?")) return;
      replaceState(parsed as CoachState);
      setKey(parsed.settings?.apiKey ?? "");
      setNotice("Backup restored.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const condense = async () => {
    if (!window.confirm("Condense the conversation into a summary? The coach keeps what matters, and the chat view starts fresh.")) return;
    setBusy(true);
    try {
      const summary = await compactNow(getState().settings.apiKey);
      // Keep the summary as the opening context of the next message.
      setState((s) => ({
        ...s,
        history: summary
          ? [
              { role: "user", content: [{ type: "text", text: `<context>\nSummary of the coaching conversation so far (your own notes):\n${summary}\n</context>` }, { type: "text", text: "Continue from your notes. Reply with one line confirming where we are." }] },
            ]
          : [],
      }));
      setNotice("Conversation condensed. Your next message continues from the coach's notes.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not condense.");
    } finally {
      setBusy(false);
    }
  };

  const clearConversation = () => {
    if (!window.confirm("Clear the conversation? Your programme, log and metrics stay.")) return;
    setState((s) => ({ ...s, history: [], stateVersion: s.stateVersion + 1 }));
    setNotice("Conversation cleared. The coach will be shown your tracked data on your next message.");
  };

  const resetAll = () => {
    if (!window.confirm("Delete everything stored in this browser: conversation, programme, log, metrics and profile?")) return;
    resetState();
    setKey("");
    setNotice("Everything was reset.");
  };

  const historyChars = JSON.stringify(state.history).length;

  return (
    <Page title="Settings">
      {notice && <div className="text-sm bg-surface-2 rounded-lg px-3 py-2 mb-4">{notice}</div>}

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Claude API key</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          The server uses its own key when <code>ANTHROPIC_API_KEY</code> is set. Otherwise a key saved here is sent with each
          request from this browser only.
        </p>
        <div className="flex gap-2 mt-3">
          <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn btn-primary" onClick={saveKey}>
            Save
          </button>
        </div>
      </section>

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Conversation</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          {state.history.length} turns stored, about {Math.round(historyChars / 1000)} k characters. Long conversations are
          condensed automatically; you can also do it now.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-ghost" onClick={condense} disabled={busy || state.history.length === 0}>
            {busy ? "Condensing…" : "Condense now"}
          </button>
          <button className="btn btn-ghost" onClick={clearConversation} disabled={busy || state.history.length === 0}>
            Clear conversation
          </button>
        </div>
      </section>

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Backup and restore</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          Everything lives in this browser. Download a JSON backup before clearing site data or switching devices.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-ghost" onClick={exportJson}>
            Download backup
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Restore from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-lg">Reset</h3>
        <p className="text-sm text-ink-2 mt-1">Start over with a new assessment.</p>
        <div className="mt-3">
          <button className="btn btn-danger" onClick={resetAll}>
            Delete all data
          </button>
        </div>
      </section>
    </Page>
  );
}
