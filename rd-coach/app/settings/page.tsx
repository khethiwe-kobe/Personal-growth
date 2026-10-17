"use client";

import { useEffect, useRef, useState } from "react";
import { Page } from "@/components/Page";
import { api } from "@/lib/api";
import { replaceState, setSession, useSession } from "@/lib/store";

type MemberRow = { id: string; username: string; name: string; isAdmin: boolean; joinedAt: string };

export default function SettingsPage() {
  const { me, state } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!me?.isAdmin) return;
    api<{ members: MemberRow[] }>("/api/members")
      .then((r) => setMembers(r.members))
      .catch(() => setMembers([]));
  }, [me?.isAdmin]);

  if (!me) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () =>
    run(async () => {
      await api("/api/auth/logout", { method: "POST" });
      setSession("signed_out", null);
    });

  const action = (name: string, done: string) =>
    run(async () => {
      const res = await api<{ state: unknown }>("/api/state", { method: "POST", body: JSON.stringify({ action: name }) });
      replaceState(res.state);
      setNotice(done);
    });

  const condense = () => {
    if (!window.confirm("Condense the conversation into the coach's notes? The chat view starts fresh; your data is kept.")) return;
    void run(async () => {
      const res = await api<{ state: unknown }>("/api/compact", { method: "POST" });
      replaceState(res.state);
      setNotice("Conversation condensed. Your next message continues from the coach's notes.");
    });
  };

  const exportJson = () =>
    run(async () => {
      const { state: fresh } = await api<{ state: unknown }>("/api/state");
      const blob = new Blob([JSON.stringify(fresh, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rd-coach-${me.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const importJson = (file: File) =>
    run(async () => {
      const parsed = JSON.parse(await file.text()) as { version?: unknown; history?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.history)) throw new Error("That file is not an RD Coach backup.");
      if (!window.confirm("Replace your coaching data with this backup? Your posts in the team feed are not affected.")) return;
      const res = await api<{ state: unknown }>("/api/state", { method: "PUT", body: JSON.stringify({ state: parsed, mode: "restore" }) });
      replaceState(res.state);
      setNotice("Backup restored.");
    });

  const removeMember = (m: MemberRow) => {
    if (!window.confirm(`Remove ${m.name} from the group? They will be signed out and hidden from the feed and scoreboard.`)) return;
    void run(async () => {
      await api(`/api/members/${m.id}`, { method: "DELETE" });
      setMembers((cur) => cur?.filter((x) => x.id !== m.id) ?? null);
      setNotice(`${m.name} was removed.`);
    });
  };

  return (
    <Page title="Settings">
      {notice && <div className="text-sm bg-surface-2 rounded-lg px-3 py-2 mb-4">{notice}</div>}

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Account</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          Signed in as <strong>{me.name}</strong> ({me.username}){me.isAdmin ? ", group admin" : ""}. Your coaching
          conversation is private. Your sessions, tests, personal bests and photos are visible to the JHB group.
        </p>
        <div className="mt-3">
          <button className="btn btn-ghost" onClick={signOut} disabled={busy}>
            Sign out
          </button>
        </div>
      </section>

      {me.isAdmin && (
        <section className="card p-5 mb-4">
          <h3 className="text-lg">Group members</h3>
          <p className="text-sm text-ink-2 mt-1 leading-relaxed">
            People join with the group code you set in Vercel as COACH_PASSCODE. Change the code there if it reaches the wrong
            people; existing members stay signed in.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {(members ?? []).map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{m.name}</span> <span className="text-ink-3">{m.username}</span>
                  {m.isAdmin && <span className="text-xs text-ink-3 ml-2">admin</span>}
                </span>
                {m.id !== me.id && (
                  <button className="text-xs text-ink-3 hover:text-danger" onClick={() => removeMember(m)} disabled={busy}>
                    Remove
                  </button>
                )}
              </li>
            ))}
            {members === null && <li className="py-2 text-sm text-ink-3">Loading…</li>}
          </ul>
        </section>
      )}

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Conversation</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          {state.history.length} turns stored. Long conversations are condensed automatically; you can also do it now.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-ghost" onClick={condense} disabled={busy || state.history.length === 0}>
            {busy ? "Working…" : "Condense now"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => window.confirm("Clear the conversation? Your programme, log and progress stay.") && action("clear_conversation", "Conversation cleared.")}
            disabled={busy || state.history.length === 0}
          >
            Clear conversation
          </button>
        </div>
      </section>

      <section className="card p-5 mb-4">
        <h3 className="text-lg">Backup and restore</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">
          Your data is saved to your account, so it follows you to any device you sign in on. A backup file is an extra copy.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-ghost" onClick={exportJson} disabled={busy}>
            Download backup
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
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
        <h3 className="text-lg">Start over</h3>
        <p className="text-sm text-ink-2 mt-1">Delete your conversation, programme, log and tests, and begin a new assessment. Team posts stay.</p>
        <div className="mt-3">
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => window.confirm("Delete all your coaching data and start over?") && action("reset", "Everything was reset. Start a new assessment on the Coach page.")}
          >
            Delete my coaching data
          </button>
        </div>
      </section>
    </Page>
  );
}
