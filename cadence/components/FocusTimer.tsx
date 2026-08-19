"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startFocusAction, focusHeartbeatAction, completeFocusAction,
  interruptFocusAction, sweepStaleFocusAction,
} from "@/app/actions";
import { Button, Ring, Card } from "./ui";
import { IconPlay, IconX } from "./icons";
import { useRouter } from "next/navigation";

type Config = {
  focusMinutes: number; breakMinutes: number; sessions: number;
  longBreakMinutes: number; breaksEnabled: boolean; autoStart: boolean;
  sound: boolean; notify: boolean; label: string;
};

const PRESETS: { name: string; c: Partial<Config> }[] = [
  { name: "Classic 25/5 ×4", c: { focusMinutes: 25, breakMinutes: 5, sessions: 4, breaksEnabled: true } },
  { name: "Deep 90/10 ×4", c: { focusMinutes: 90, breakMinutes: 10, sessions: 4, breaksEnabled: true } },
  { name: "Half-day 3h", c: { focusMinutes: 180, sessions: 1, breaksEnabled: false } },
  { name: "Marathon 6h", c: { focusMinutes: 360, sessions: 1, breaksEnabled: false } },
];

const REASONS: [string, string][] = [
  ["distracted", "Got distracted"],
  ["urgent", "Needed to handle something urgent"],
  ["unplanned_break", "Took an unplanned break"],
  ["technical", "Technical issue"],
  ["other", "Other"],
];

type Phase = { kind: "focus" | "break" | "longbreak"; seconds: number };

function buildPhases(c: Config): Phase[] {
  const phases: Phase[] = [];
  for (let i = 0; i < c.sessions; i++) {
    phases.push({ kind: "focus", seconds: c.focusMinutes * 60 });
    if (c.breaksEnabled && i < c.sessions - 1) {
      const isLong = c.longBreakMinutes > 0 && (i + 1) % 4 === 0;
      phases.push({
        kind: isLong ? "longbreak" : "break",
        seconds: (isLong ? c.longBreakMinutes : c.breakMinutes) * 60,
      });
    }
  }
  return phases;
}

function beep(times = 2) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch {}
}

function fmt(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function FocusTimer({ defaults }: { defaults: Partial<Config> }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config>({
    focusMinutes: 50, breakMinutes: 10, sessions: 2, longBreakMinutes: 20,
    breaksEnabled: true, autoStart: true, sound: true, notify: false, label: "",
    ...defaults,
  });
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [waiting, setWaiting] = useState(false); // between phases when autoStart off
  const [finished, setFinished] = useState(false);
  const [askReason, setAskReason] = useState<null | { id: number; stale?: boolean }>(null);
  const [customReason, setCustomReason] = useState("");
  const focusAccrued = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sweep sessions abandoned in a previous visit (closed tab / refresh).
  useEffect(() => {
    sweepStaleFocusAction().then((ids) => {
      if (ids.length) setAskReason({ id: ids[ids.length - 1], stale: true });
    });
  }, []);

  const active = sessionId !== null && !finished;
  const phase = phases[phaseIdx];

  const start = async () => {
    const focusTotal = cfg.focusMinutes * cfg.sessions;
    const id = await startFocusAction({ ...cfg, focusMinutes: focusTotal });
    const p = buildPhases(cfg);
    focusAccrued.current = 0;
    setSessionId(id);
    setPhases(p);
    setPhaseIdx(0);
    setRemaining(p[0].seconds);
    setRunning(true);
    setFinished(false);
    if (cfg.notify && "Notification" in window && Notification.permission === "default")
      Notification.requestPermission();
  };

  const notifyMsg = useCallback((title: string, body: string) => {
    if (cfg.sound) beep();
    if (cfg.notify && "Notification" in window && Notification.permission === "granted")
      new Notification(title, { body });
  }, [cfg.sound, cfg.notify]);

  // main tick
  useEffect(() => {
    if (!running || !active) return;
    tickRef.current = setInterval(() => {
      if (phase?.kind === "focus") focusAccrued.current += 1;
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, active, phase?.kind]);

  // phase transitions
  useEffect(() => {
    if (!active || !running || remaining > 0 || phases.length === 0) return;
    setRunning(false);
    const nextIdx = phaseIdx + 1;
    if (nextIdx >= phases.length) {
      setFinished(true);
      notifyMsg("Focus complete", "Session finished — well done.");
      if (sessionId) completeFocusAction(sessionId, focusAccrued.current).then(() => router.refresh());
    } else {
      notifyMsg(
        phase?.kind === "focus" ? "Break time" : "Back to focus",
        phase?.kind === "focus" ? "Step away for a moment." : "Break over."
      );
      setPhaseIdx(nextIdx);
      setRemaining(phases[nextIdx].seconds);
      if (cfg.autoStart) setRunning(true);
      else setWaiting(true);
    }
  }, [remaining, running, active, phaseIdx, phases, sessionId, cfg.autoStart, notifyMsg, phase?.kind, router]);

  // heartbeat
  useEffect(() => {
    if (!active) return;
    const h = setInterval(() => {
      if (sessionId) focusHeartbeatAction(sessionId, focusAccrued.current);
    }, 15000);
    return () => clearInterval(h);
  }, [active, sessionId]);

  // leaving the tab during a focus phase = interruption (integrity rule)
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        const away = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (away > 30_000 && running && phase?.kind === "focus" && sessionId) {
          setRunning(false);
          setAskReason({ id: sessionId });
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, running, phase?.kind, sessionId]);

  const giveUp = () => {
    if (sessionId) {
      setRunning(false);
      setAskReason({ id: sessionId });
    }
  };

  const submitReason = async (reason: string) => {
    if (!askReason) return;
    await interruptFocusAction(
      askReason.id, askReason.stale ? 0 : focusAccrued.current,
      reason, reason === "other" ? customReason : ""
    );
    if (!askReason.stale) {
      setSessionId(null);
      setPhases([]);
      setFinished(false);
    }
    setAskReason(null);
    setCustomReason("");
    router.refresh();
  };

  const fullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // ------- render -------

  if (askReason) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h2 className="font-display text-xl font-medium">Focus session interrupted</h2>
        <p className="mt-1 text-sm text-ink-2">
          {askReason.stale
            ? "A previous session ended without finishing. What happened?"
            : "You left mid-session. Why?"}
        </p>
        <div className="mt-4 space-y-2">
          {REASONS.map(([v, label]) => (
            <button key={v}
              onClick={() => v !== "other" && submitReason(v)}
              className={`w-full rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-surface-2 ${v === "other" ? "cursor-default opacity-80" : ""}`}
            >
              {label}
            </button>
          ))}
          <div className="flex gap-2">
            <input value={customReason} onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Custom reason…" />
            <Button variant="soft" type="button" onClick={() => submitReason("other")}>Log</Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-ink-3">
          Interruptions are recorded honestly in your analytics — the history is never deleted.
        </p>
      </Card>
    );
  }

  if (active && phases.length) {
    const total = phase?.seconds ?? 1;
    const pct = ((total - remaining) / total) * 100;
    const focusPhases = phases.filter((p) => p.kind === "focus").length;
    const focusDone = phases.slice(0, phaseIdx).filter((p) => p.kind === "focus").length;
    return (
      <Card className="mx-auto max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
          {finished ? "Complete" : phase?.kind === "focus" ? (cfg.label || "Focus") : "Break"}
          {!finished && focusPhases > 1 && ` · session ${Math.min(focusDone + 1, focusPhases)}/${focusPhases}`}
        </p>
        <div className="my-6 flex justify-center">
          <Ring
            pct={finished ? 100 : pct} size={210} stroke={9}
            color={phase?.kind === "focus" || finished ? "var(--accent)" : "var(--warn)"}
            label={
              <span className="font-display text-4xl font-medium tabular-nums">
                {finished ? "Done" : fmt(remaining)}
              </span>
            }
            sub={finished ? `${Math.round(focusAccrued.current / 60)} focused minutes` : undefined}
          />
        </div>
        {finished ? (
          <Button type="button" onClick={() => { setSessionId(null); setPhases([]); setFinished(false); }}>
            Set up another session
          </Button>
        ) : waiting ? (
          <Button type="button" onClick={() => { setWaiting(false); setRunning(true); }}>
            <IconPlay size={15} /> Start {phase?.kind === "focus" ? "focus" : "break"}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {running ? (
              <Button variant="ghost" type="button" onClick={() => setRunning(false)}>Pause</Button>
            ) : (
              <Button type="button" onClick={() => setRunning(true)}><IconPlay size={15} /> Resume</Button>
            )}
            <Button variant="ghost" type="button" onClick={fullscreen}>Full screen</Button>
            <Button variant="danger" type="button" onClick={giveUp}><IconX size={14} /> End early</Button>
          </div>
        )}
        {!finished && (
          <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
            Leaving this tab for more than 30 seconds during focus counts as an interruption.
            Stay with it.
          </p>
        )}
      </Card>
    );
  }

  // config form
  return (
    <Card className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} type="button"
            onClick={() => setCfg((c) => ({ ...c, longBreakMinutes: 0, ...p.c }))}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-accent hover:text-accent-ink">
            {p.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">Focus (minutes)</span>
          <input type="number" min={5} max={720} value={cfg.focusMinutes}
            onChange={(e) => setCfg({ ...cfg, focusMinutes: Number(e.target.value) || 0 })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">Sessions</span>
          <input type="number" min={1} max={12} value={cfg.sessions}
            onChange={(e) => setCfg({ ...cfg, sessions: Number(e.target.value) || 1 })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">Label (optional)</span>
          <input value={cfg.label} placeholder="e.g. Study"
            onChange={(e) => setCfg({ ...cfg, label: e.target.value })} />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" checked={cfg.breaksEnabled}
            onChange={(e) => setCfg({ ...cfg, breaksEnabled: e.target.checked })} />
          Breaks between sessions
        </label>
        {cfg.breaksEnabled && (
          <>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-3">Break (minutes)</span>
              <input type="number" min={1} max={120} value={cfg.breakMinutes}
                onChange={(e) => setCfg({ ...cfg, breakMinutes: Number(e.target.value) || 0 })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-3">Long break every 4th (min)</span>
              <input type="number" min={0} max={180} value={cfg.longBreakMinutes}
                onChange={(e) => setCfg({ ...cfg, longBreakMinutes: Number(e.target.value) || 0 })} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={cfg.autoStart}
                onChange={(e) => setCfg({ ...cfg, autoStart: e.target.checked })} />
              Auto-start next
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.sound}
            onChange={(e) => setCfg({ ...cfg, sound: e.target.checked })} />
          Sound
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.notify}
            onChange={(e) => setCfg({ ...cfg, notify: e.target.checked })} />
          Browser notifications
        </label>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-ink-3">
          Total focus: <strong>{Math.round(cfg.focusMinutes * cfg.sessions / 6) / 10}h</strong>
        </p>
        <Button type="button" onClick={start} disabled={cfg.focusMinutes < 5}>
          <IconPlay size={15} /> Start focusing
        </Button>
      </div>
    </Card>
  );
}
