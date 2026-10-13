"use client";

import { useRef, useState } from "react";
import { Page } from "@/components/Page";
import { compactNow } from "@/lib/coach/client";
import { getState, replaceState, resetState, setState, useCoachState } from "@/lib/store";

export default function SettingsPage() {
  const state = useCoachState();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const forgetPasscode = () => {
    if (!window.confirm("Remove the passcode from this device? You will need it again to use the coach.")) return;
    setState((s) => ({ ...s, settings: { ...s.settings, passcode: "" } }));
  };

  const exportJson = () => {
    // The passcode is left out so a shared backup file does not give access.
    const { settings: _settings, ...data } = getState();
    void _settings;
    const blob = new Blob([JSON.stringify({ ...data, settings: { passcode: "" } }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rd-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { version?: unknown; history?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.history)) throw new Error("Not an RD Coach backup.");
      if (!window.confirm("Replace everything on this device with the backup?")) return;
      // Keep this device's passcode rather than whatever the backup carried.
      const passcode = getState().settings.passcode;
      replaceState(parsed);
      setState((s) => ({ ...s, settings: { ...s.settings, passcode } }));
      setNotice("Backup restored.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const condense = async () => {
    if (!window.confirm("Condense the conversation into the coach's notes? The chat view starts fresh; your data is kept.")) return;
    setBusy(true);
    try {
      await compactNow();
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
    setNotice("Everything was reset.");
  };

  const historyChars = JSON.stringify(state.history).length;

  return (
    <Page title="Settings">
      {notice && <div className="text-sm bg-surface-2 rounded-lg px-3 py-2 mb-4">{notice}</div>}

      {state.settings.passcode && (
        <section className="card p-5 mb-4">
          <h3 className="text-lg">Access</h3>
          <p className="text-sm text-ink-2 mt-1 leading-relaxed">
            This device has the passcode saved. Remove it on a shared or borrowed device.
          </p>
          <div className="mt-3">
            <button className="btn btn-ghost" onClick={forgetPasscode}>
              Forget passcode on this device
            </button>
          </div>
        </section>
      )}

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
          Your data lives only on this device. Download a backup to move it to another phone or computer, or before clearing site data.
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
