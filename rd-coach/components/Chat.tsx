"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/lib/markdown";
import { sendToCoach } from "@/lib/coach/client";
import { useCoachState } from "@/lib/store";
import { dayOf, longDate, weekdayName } from "@/lib/time";
import { CONTEXT_PREFIX, PHASES, type ChatContent } from "@/lib/types";
import { PhotoComposer } from "./PhotoComposer";
import { ReportForm } from "./ReportForm";

type Item =
  | { kind: "user"; text: string; key: string }
  | { kind: "coach"; text: string; key: string }
  | { kind: "saved"; names: string[]; key: string };

const SAVED_LABEL: Record<string, string> = {
  update_profile: "Profile updated",
  record_metric: "Metric recorded",
  save_programme: "Programme saved",
  log_workout: "Session logged",
  set_phase: "Phase updated",
};

function toItems(history: ChatContent[]): Item[] {
  const items: Item[] = [];
  history.forEach((c, ci) => {
    let coachText = "";
    const saved: string[] = [];
    c.parts.forEach((p, pi) => {
      if (p.thought) return;
      if (typeof p.text === "string" && p.text) {
        if (c.role === "user") {
          if (!p.text.startsWith(CONTEXT_PREFIX)) items.push({ kind: "user", text: p.text, key: `${ci}-${pi}` });
        } else coachText += p.text;
      } else if (p.functionCall?.name) {
        saved.push(SAVED_LABEL[p.functionCall.name] ?? p.functionCall.name);
      }
    });
    if (coachText.trim()) items.push({ kind: "coach", text: coachText, key: `${ci}-c` });
    if (saved.length) items.push({ kind: "saved", names: Array.from(new Set(saved)), key: `${ci}-s` });
  });
  return items;
}

export function Chat() {
  const state = useCoachState();
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const items = useMemo(() => toItems(state.history), [state.history]);
  const phase = PHASES.find((p) => p.id === state.phase) ?? PHASES[0];
  const hasProgress =
    Object.keys(state.profile).length > 0 || !!state.programme || state.logs.length > 0 || !!state.pendingSummary;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items.length, draft]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setNotice(null);
    setStatus(null);
    setDraft("");
    setBusy(true);
    await sendToCoach(trimmed, {
      onText: (d) => {
        setStatus(null);
        setDraft((t) => t + d);
      },
      onReset: () => setDraft(""),
      onStatus: (t) => setStatus(t),
      onNotice: (m) => setNotice(m),
      onDone: (kept) => {
        setBusy(false);
        setDraft("");
        setStatus(null);
        // Nothing was recorded: give the message back so it can be resent.
        if (!kept) setInput((cur) => cur || trimmed);
      },
    });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const today = weekdayName(dayOf()).toLowerCase();
  const todaysSession = state.programme?.schedule.find((d) => d.day.toLowerCase() === today);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32 flex flex-col gap-5">
          {items.length === 0 && !busy && hasProgress && (
            <div className="card p-6 md:p-8 mt-6 fade-in">
              <h1 className="text-2xl md:text-3xl">Pick up where you left off.</h1>
              <p className="text-ink-2 mt-3 leading-relaxed">
                The conversation view is empty, but your profile, programme, log and progress are all here. Your coach will be
                shown them with your next message.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => send("Let's continue from where we were.")}>
                  Continue coaching
                </button>
              </div>
            </div>
          )}

          {items.length === 0 && !busy && !hasProgress && (
            <div className="card p-6 md:p-8 mt-6 fade-in">
              <h1 className="text-2xl md:text-3xl">Prepare for RD.</h1>
              <p className="text-ink-2 mt-3 leading-relaxed">
                Your coach will interview you in short groups of questions, assess your strengths and weaknesses, build a
                periodised programme for the weeks you have, then prescribe each session and adjust it from what you report.
              </p>
              <p className="text-ink-3 text-sm mt-3">
                Your coaching conversation is private. Sessions, new bests and photos are shared with the JHB group.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => send("I'm ready to begin. Please start the assessment.")}>
                  Begin assessment
                </button>
              </div>
            </div>
          )}

          {items.map((it) =>
            it.kind === "user" ? (
              <div key={it.key} className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft text-ink px-4 py-3 text-[0.95rem] whitespace-pre-wrap leading-relaxed">
                {it.text}
              </div>
            ) : it.kind === "coach" ? (
              <div key={it.key} className="max-w-full prose">
                <Markdown text={it.text} />
              </div>
            ) : (
              <div key={it.key} className="text-xs text-ink-3 border-l-2 border-line-2 pl-3">
                {it.names.join(" · ")}
              </div>
            ),
          )}

          {busy && (
            <div className="prose fade-in">
              {draft ? (
                <Markdown text={draft} />
              ) : (
                <div className="flex items-center gap-1.5 py-2">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  {status && <span className="text-xs text-ink-3 ml-2">{status}</span>}
                </div>
              )}
            </div>
          )}

          {notice && !busy && (
            <div className="text-sm text-ink-2 bg-surface-2 rounded-lg px-3 py-2 fade-in">{notice}</div>
          )}

          {showPhoto && (
            <PhotoComposer
              onClose={() => setShowPhoto(false)}
              onPosted={() => {
                setShowPhoto(false);
                setNotice("Progress photo posted to the team feed.");
              }}
            />
          )}

          {showReport && (
            <ReportForm
              session={todaysSession?.session}
              onClose={() => setShowReport(false)}
              onSubmit={(text) => {
                setShowReport(false);
                void send(text);
              }}
            />
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="sticky bottom-16 md:bottom-0 bg-bg/95 backdrop-blur border-t border-line">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-ink-3 mr-1">{phase.label}</span>
              {state.programme && (
                <button
                  className="btn btn-ghost !py-1 !px-2.5 !text-xs"
                  disabled={busy}
                  onClick={() => send(`It's ${longDate()}. What is my workout today?`)}
                >
                  Today&apos;s session
                </button>
              )}
              {state.programme && (
                <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" disabled={busy} onClick={() => setShowReport((v) => !v)}>
                  Report a session
                </button>
              )}
              <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" onClick={() => setShowPhoto((v) => !v)}>
                Progress photo
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="input resize-none min-h-[46px] max-h-40"
              rows={1}
              placeholder={items.length === 0 ? "Or type a message to your coach" : "Message your coach"}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={onKey}
              disabled={busy}
            />
            <button className="btn btn-primary" onClick={() => send(input)} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
