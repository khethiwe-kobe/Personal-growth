"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  roomHeartbeatAction, leaveFocusRoomAction, roomSayAction, roomProgressAction,
  enterFocusRoomAction, endFocusSessionAction, recordInterruptionReasonAction,
  toggleTaskAction,
} from "@/app/actions";
import { Button } from "./ui";
import { IconCheck, IconX } from "./icons";
import Avatar from "./Avatar";
import FocusTasks from "./FocusTasks";
import type { TaskRow, CategoryRow } from "@/lib/types";

/*
 * The focus room: the accountability mechanism for planned focus sessions.
 *
 * Planner task → lobby → camera-on presence → task-connected timer → complete
 * from inside → one focus_sessions record → analytics. The server owns the
 * truth about presence and focused time; this component draws it and reports
 * heartbeats.
 */

type Anchor = {
  id: number; name: string; start_min: number | null; end_min: number | null;
  planned_minutes: number; completed: number;
} | null;

type Member = {
  userId: number; name: string; accent: string; hasAvatar: boolean;
  here: boolean; away: boolean; gone: boolean; awayCount: number; awaySecs: number;
  presentSecs: number; cameraOn: boolean; interruptions: number;
  done: number; total: number; sharesList: boolean;
};
type Message = { id: number; userId: number; name: string; body: string; kind: string; at: string };

const HEARTBEAT_MS = 10_000;
const POLL_MS = 2_500;
const SIGNAL_MS = 1_500;

const REASONS: [string, string][] = [
  ["distracted", "Got distracted"],
  ["urgent", "Needed to handle something urgent"],
  ["unplanned_break", "Took an unplanned break"],
  ["technical", "Technical issue"],
  ["other", "Other"],
];

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => {
  const neg = s < 0; const a = Math.abs(s);
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), x = a % 60;
  return `${neg ? "+" : ""}${h > 0 ? `${h}:${pad(m)}` : m}:${pad(x)}`;
};
const hm = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
};
const clockOfMin = (min: number) =>
  `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const msgTime = (at: string) => {
  const d = new Date(at.includes("T") ? at : at.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FocusRoom({
  roomId, meId, anchor, sessionTasks, categories, date, ice, alreadyIn,
}: {
  roomId: number;
  meId: number;
  anchor: Anchor;
  sessionTasks: TaskRow[];
  categories: CategoryRow[];
  date: string;
  ice: RTCIceServer[];
  alreadyIn: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"lobby" | "in" | "ended">(alreadyIn ? "in" : "lobby");
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [immersive, setImmersive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [peerTrouble, setPeerTrouble] = useState<number[]>([]);
  const [shareList, setShareList] = useState(false);
  const [entering, setEntering] = useState(false);
  const [interrupted, setInterrupted] = useState<{ awaySecs: number } | null>(null);
  const [intReason, setIntReason] = useState("distracted");
  const [intNote, setIntNote] = useState("");
  const [summary, setSummary] = useState<{
    focusedSecs: number; plannedMinutes: number; interruptions: number;
  } | null>(null);
  const [anchorDone, setAnchorDone] = useState(!!anchor?.completed);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const peers = useRef<Map<number, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<number, MediaStream>>(new Map());
  const retries = useRef<Map<number, number>>(new Map());
  const lastMsgId = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const focusedRef = useRef({ base: 0, at: Date.now(), here: true });
  const doneRef = useRef({
    d: sessionTasks.filter((t) => t.completed).length,
    total: sessionTasks.length,
  });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const cameraOnRef = useRef(cameraOn);
  cameraOnRef.current = cameraOn;

  const ICE: RTCConfiguration = useMemo(
    () => ({ iceServers: ice, iceCandidatePoolSize: 2 }),
    [ice]
  );

  const me = members.find((m) => m.userId === meId);
  const others = members.filter((m) => m.userId !== meId && !m.gone);
  const present = [me, ...others].filter(Boolean) as Member[];

  // ---- planned / focused / remaining, from the server's numbers ----
  const plannedSecs =
    anchor && anchor.start_min !== null && anchor.end_min !== null
      ? (anchor.end_min - anchor.start_min) * 60
      : (anchor?.planned_minutes ?? 0) * 60;
  const focusedSecs =
    focusedRef.current.base +
    (phase === "in" && focusedRef.current.here
      ? Math.floor((Date.now() - focusedRef.current.at) / 1000)
      : 0);
  const remainingSecs = plannedSecs > 0 ? plannedSecs - focusedSecs : null;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- camera: video only, the microphone is never requested ----
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        tick((n) => n + 1);
      })
      .catch(() => {
        setCameraOn(false);
        setCamError(
          "Camera access is needed for accountability — the others can't see you're here. " +
            "Allow the camera in your browser's site settings (the icon by the address bar), then reload."
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleCamera = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    void roomHeartbeatAction(roomId, document.visibilityState === "visible", track.enabled);
  };

  // ---- room state poll (lobby needs it too, to show who is already in) ----
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/state?since=${lastMsgId.current}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members);
          const mine = (data.members as Member[]).find((m) => m.userId === meId);
          if (mine) {
            focusedRef.current = { base: mine.presentSecs, at: Date.now(), here: mine.here };
          }
          if (data.messages.length) {
            lastMsgId.current = data.messages[data.messages.length - 1].id;
            setMessages((prev) => [...prev, ...data.messages].slice(-120));
          }
        }
      } catch { /* keep polling */ }
      if (!stop) setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { stop = true; };
  }, [roomId, meId]);

  // ---- signalling + peers, only once seated ----
  const send = useCallback(
    async (to: number, payload: unknown) => {
      await fetch(`/api/room/${roomId}/signal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, payload }),
      }).catch(() => {});
    },
    [roomId]
  );

  const shouldOffer = useCallback((otherId: number) => meId < otherId, [meId]);
  const shouldOfferRef = useRef(shouldOffer);
  shouldOfferRef.current = shouldOffer;

  const peerFor = useCallback(
    (otherId: number) => {
      const existing = peers.current.get(otherId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      peers.current.set(otherId, pc);
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
      pc.ontrack = (e) => {
        remoteStreams.current.set(otherId, e.streams[0]);
        tick((n) => n + 1);
      };
      pc.onnegotiationneeded = async () => {
        if (!shouldOfferRef.current(otherId)) return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          void send(otherId, { description: pc.localDescription });
        } catch { /* the poll loop will try again */ }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(otherId, { candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          const tries = (retries.current.get(otherId) ?? 0) + 1;
          retries.current.set(otherId, tries);
          if (tries <= 2) {
            try { pc.restartIce(); } catch { /* fall through */ }
          } else {
            setPeerTrouble((prev) => (prev.includes(otherId) ? prev : [...prev, otherId]));
          }
        } else if (pc.connectionState === "connected") {
          retries.current.set(otherId, 0);
          setPeerTrouble((prev) => prev.filter((id) => id !== otherId));
        }
      };
      return pc;
    },
    [ICE, send]
  );

  useEffect(() => {
    if (phase !== "in") return;
    let stop = false;
    const loop = async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/signal`);
        if (res.ok) {
          const { signals } = (await res.json()) as {
            signals: { from: number; payload: Record<string, unknown> }[];
          };
          for (const sig of signals) {
            const pc = peerFor(sig.from);
            if (sig.payload.description) {
              const desc = sig.payload.description as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(desc);
              if (desc.type === "offer") {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                void send(sig.from, { description: pc.localDescription });
              }
            } else if (sig.payload.candidate) {
              await pc.addIceCandidate(sig.payload.candidate as RTCIceCandidateInit).catch(() => {});
            }
          }
        }
      } catch { /* keep polling */ }
      if (!stop) setTimeout(loop, SIGNAL_MS);
    };
    loop();
    return () => { stop = true; };
  }, [phase, roomId, peerFor, send]);

  useEffect(() => {
    if (phase !== "in") return;
    for (const other of others) {
      if (!other.here || peers.current.has(other.userId) || !shouldOffer(other.userId)) continue;
      const pc = peerFor(other.userId);
      void (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void send(other.userId, { description: pc.localDescription });
      })();
    }
  }, [phase, others, peerFor, send, shouldOffer]);

  // ---- presence: heartbeats + immediate leave/return detection ----
  useEffect(() => {
    if (phase !== "in") return;
    const beat = (p: boolean) => { void roomHeartbeatAction(roomId, p, cameraOnRef.current); };
    beat(true);
    const timer = setInterval(() => beat(document.visibilityState === "visible"), HEARTBEAT_MS);
    const onVis = () => {
      const visible = document.visibilityState === "visible";
      if (!visible) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current) {
        const away = Math.round((Date.now() - hiddenAt.current) / 1000);
        hiddenAt.current = null;
        // Coming back after a real absence is an interruption: name it.
        if (away >= 15) setInterrupted({ awaySecs: away });
      }
      beat(visible);
    };
    const onLeave = () => {
      navigator.sendBeacon?.(`/api/room/${roomId}/absent`);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [phase, roomId]);

  // ---- shared progress ----
  const [progress, setProgress] = useState(doneRef.current);
  useEffect(() => {
    const t = setInterval(() => setProgress({ ...doneRef.current }), 1500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (phase !== "in") return;
    void roomProgressAction(roomId, progress.d, progress.total, shareList);
  }, [phase, roomId, progress.d, progress.total, shareList]);

  // ---- actions ----
  const enter = async () => {
    setEntering(true);
    try {
      await enterFocusRoomAction(roomId);
      setPhase("in");
    } finally {
      setEntering(false);
    }
  };

  const completeAnchor = () => {
    if (!anchor) return;
    setAnchorError(null);
    void toggleTaskAction(anchor.id, true).then((res) => {
      if (res && "error" in res) setAnchorError(res.error);
      else { setAnchorDone(true); router.refresh(); }
    });
  };

  const endSession = async () => {
    const res = await endFocusSessionAction(roomId);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    peers.current.forEach((pc) => pc.close());
    if (!("error" in res)) { setSummary(res); setPhase("ended"); setImmersive(false); }
  };

  const leave = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    peers.current.forEach((pc) => pc.close());
    await leaveFocusRoomAction(roomId);
    router.push("/focus");
  };

  const say = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void roomSayAction(roomId, text);
  };

  const submitInterruption = () => {
    void recordInterruptionReasonAction(roomId, intReason, intNote);
    setInterrupted(null);
    setIntNote("");
  };

  const avatarFor = (userId: number) => {
    const m = members.find((x) => x.userId === userId);
    return m ? (
      <Avatar name={m.name} accent={m.accent} userId={m.userId} hasAvatar={m.hasAvatar} size={20} />
    ) : null;
  };

  const tileFor = (m: Member) => (
    <Tile
      key={m.userId}
      m={m}
      isMe={m.userId === meId}
      stream={m.userId === meId ? streamRef.current : remoteStreams.current.get(m.userId) ?? null}
      trouble={peerTrouble.includes(m.userId)}
    />
  );

  // ================= LOBBY =================
  if (phase === "lobby") {
    const here = members.filter((m) => m.here);
    const opensAt =
      anchor?.start_min !== null && anchor?.start_min !== undefined
        ? clockOfMin(anchor.start_min) : null;
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-line bg-surface p-6" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-3">Ready to focus?</p>
          <h2 className="mt-1 font-display text-2xl font-medium">{anchor?.name ?? "Focus session"}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {plannedSecs > 0 && (
              <div>
                <dt className="text-[11px] text-ink-3">Planned</dt>
                <dd className="font-medium">{hm(plannedSecs)}</dd>
              </div>
            )}
            {opensAt && (
              <div>
                <dt className="text-[11px] text-ink-3">Scheduled</dt>
                <dd className="font-medium">
                  {opensAt}{anchor?.end_min !== null && anchor?.end_min !== undefined ? `–${clockOfMin(anchor.end_min)}` : ""}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] text-ink-3">Camera</dt>
              <dd className="font-medium">{camError ? "Blocked" : "On"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-3">Microphone</dt>
              <dd className="font-medium">Never requested</dd>
            </div>
          </dl>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-black/80">
            <video
              autoPlay playsInline muted
              ref={(el) => { if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current; }}
              className="aspect-video w-full object-cover"
            />
          </div>
          {camError && (
            <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-danger">
              {camError} You can still enter — you'll show as camera off.
            </p>
          )}

          <div className="mt-4">
            <p className="mb-1 text-[11px] text-ink-3">
              {here.length === 0 ? "Nobody is in the room yet." : "Already in the room:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {here.map((m) => (
                <span key={m.userId} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  <Avatar name={m.name} accent={m.accent} userId={m.userId} hasAvatar={m.hasAvatar} size={18} />
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button type="button" onClick={enter} disabled={entering} className="flex-1">
              {entering ? "Entering…" : "Enter Focus Room"}
            </Button>
            <Button variant="ghost" type="button" onClick={() => router.push("/focus")}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            Joining starts your session. Completing the task is only possible from inside,
            and leaving the tab is flagged to the room and recorded.
          </p>
        </div>
      </div>
    );
  }

  // ================= ENDED =================
  if (phase === "ended" && summary) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-3">Session complete</p>
          <h2 className="mt-1 font-display text-2xl font-medium">{anchor?.name ?? "Focus session"}</h2>
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-3 gap-3 text-sm">
            <div><p className="text-[11px] text-ink-3">Planned</p><p className="font-medium">{hm(summary.plannedMinutes * 60)}</p></div>
            <div><p className="text-[11px] text-ink-3">Focused</p><p className="font-medium">{hm(summary.focusedSecs)}</p></div>
            <div><p className="text-[11px] text-ink-3">Interruptions</p><p className="font-medium">{summary.interruptions}</p></div>
          </div>
          <p className="mt-3 text-sm text-ink-2">
            {anchorDone ? "Task completed." : "Task not completed — it stays open in your planner."}
          </p>
          <Button className="mt-5" type="button" onClick={() => router.push("/focus")}>
            Back to Focus
          </Button>
        </div>
      </div>
    );
  }

  // ================= IN SESSION =================
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-3">
          Currently focusing on
        </p>
        <h2 className="truncate font-display text-xl font-medium">{anchor?.name ?? "Focus session"}</h2>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-ink-3">
          {plannedSecs > 0 && <span>Planned <strong className="text-ink">{hm(plannedSecs)}</strong></span>}
          <span>Focused <strong className="text-ink">{hm(focusedSecs)}</strong></span>
          {remainingSecs !== null && (
            <span>
              {remainingSecs >= 0 ? "Remaining " : "Over by "}
              <strong className={remainingSecs >= 0 ? "text-ink" : "text-warn"}>
                {hm(Math.abs(remainingSecs))}
              </strong>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-4xl font-medium tabular-nums" aria-label="Session timer">
          {remainingSecs !== null ? clock(remainingSecs) : clock(focusedSecs)}
        </span>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <Button variant="ghost" type="button" className="!py-1.5 !text-xs" onClick={toggleCamera}>
              {cameraOn ? "Camera off" : "Camera on"}
            </Button>
            {!immersive ? (
              <Button variant="ghost" type="button" className="!py-1.5 !text-xs"
                onClick={() => { setImmersive(true); document.documentElement.requestFullscreen?.().catch(() => {}); }}>
                Full screen
              </Button>
            ) : (
              <Button variant="ghost" type="button" className="!py-1.5 !text-xs"
                onClick={() => { setImmersive(false); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }}>
                Exit full screen
              </Button>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button type="button" className="!py-1.5 !text-xs" onClick={endSession}>
              <IconCheck size={13} /> End session
            </Button>
            <Button variant="ghost" type="button" className="!py-1.5 !text-xs text-danger" onClick={leave}>
              <IconX size={12} /> Leave
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const gridCols =
    present.length <= 1 ? "grid-cols-1" : present.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";

  const body = (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`grid content-start gap-3 ${gridCols}`}>
        {present.map(tileFor)}
        {others.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-ink-3">
            You&apos;re the first one here. The others will appear as they join.
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <FocusTasks
            tasks={sessionTasks}
            categories={categories}
            date={date}
            compact
            onProgress={(d, total) => { doneRef.current = { d, total }; }}
          />
          {anchor && !anchorDone && (
            <Button type="button" variant="soft" className="mt-3 w-full !py-2 !text-xs" onClick={completeAnchor}>
              <IconCheck size={13} /> Mark “{anchor.name.slice(0, 40)}” complete
            </Button>
          )}
          {anchor && anchorDone && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ok">
              <IconCheck size={13} /> {anchor.name.slice(0, 50)} — completed
            </p>
          )}
          {anchorError && (
            <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[11px] text-danger">{anchorError}</p>
          )}
          <label className="mt-3 flex items-center gap-2 text-[11px] text-ink-2">
            <input type="checkbox" checked={shareList} onChange={(e) => setShareList(e.target.checked)} />
            Share my task details with the room
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Room chat</h3>
          <ul className="mb-2 max-h-52 flex-1 space-y-1.5 overflow-y-auto text-xs">
            {messages.map((m) =>
              m.kind === "system" ? (
                <li key={m.id} className="italic text-ink-3">{m.body}</li>
              ) : (
                <li key={m.id} className="flex items-start gap-1.5">
                  {avatarFor(m.userId)}
                  <span className="min-w-0">
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-1 text-[10px] text-ink-3">{msgTime(m.at)}</span>
                    <span className="block text-ink-2">{m.body}</span>
                  </span>
                </li>
              )
            )}
            {messages.length === 0 && <li className="text-ink-3">Say something to the room.</li>}
          </ul>
          <div className="flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); say(); } }}
              placeholder="Message the room…" maxLength={500} className="min-w-0 flex-1 text-sm"
            />
            <button type="button" onClick={say}
              className="shrink-0 rounded-lg border border-line px-3 text-sm text-ink-2">Send</button>
          </div>
        </div>
      </div>
    </div>
  );

  const interruptionDialog = interrupted && (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="font-display text-lg font-medium">Focus session interrupted</h3>
        <p className="mt-1 text-sm text-ink-2">
          You were away for <strong>{hm(interrupted.awaySecs)}</strong>. Why did you leave?
        </p>
        <div className="mt-3 space-y-1.5">
          {REASONS.map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-2">
              <input type="radio" name="int-reason" value={v}
                checked={intReason === v} onChange={() => setIntReason(v)} />
              {l}
            </label>
          ))}
          {intReason === "other" && (
            <input value={intNote} onChange={(e) => setIntNote(e.target.value)}
              placeholder="What happened?" maxLength={300} className="w-full text-sm" />
          )}
        </div>
        <Button className="mt-4 w-full" type="button" onClick={submitInterruption}>
          Resume Focus Session
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-3">
          Recorded in your session history — the history is never deleted.
        </p>
      </div>
    </div>
  );

  if (immersive && mounted) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-bg px-5 py-5">
        {header}
        {body}
        {interruptionDialog}
      </div>,
      document.body
    );
  }

  return (
    <div>
      {header}
      {camError && (
        <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-danger">{camError}</p>
      )}
      {body}
      {mounted && interruptionDialog ? createPortal(interruptionDialog, document.body) : null}
    </div>
  );
}

/**
 * Module-scope so the <video> element survives re-renders — declaring it
 * inside the room made React rebuild the element each render and the picture
 * stuttered.
 */
function Tile({
  m, isMe, stream, trouble,
}: { m: Member; isMe: boolean; stream: MediaStream | null; trouble: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stream && el.srcObject !== stream) el.srcObject = stream;
    if (!stream && el.srcObject) el.srcObject = null;
  }, [stream]);

  const status = m.away
    ? { dot: "bg-warn", label: `Away ${m.awaySecs >= 60 ? Math.round(m.awaySecs / 60) + "m" : ""}`.trim() }
    : m.here
      ? { dot: "bg-ok", label: "Focused" }
      : { dot: "bg-ink-3", label: "Left" };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-surface-2 ${
      m.away ? "border-warn" : "border-line"
    }`}>
      <video
        ref={ref} autoPlay playsInline muted={isMe}
        className="aspect-video w-full bg-black/80 object-cover"
      />
      {(!stream || !m.cameraOn) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-white/75">
          <Avatar name={m.name} accent={m.accent} userId={m.userId} hasAvatar={m.hasAvatar} size={40} />
          {!m.cameraOn ? "Camera off" : isMe ? "Starting your camera…" : `Waiting for ${m.name}…`}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/45 px-2 py-1 text-[11px] text-white">
        <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden />
        <span className="truncate font-medium">{m.name}{isMe ? " (you)" : ""}</span>
        <span className="shrink-0 opacity-80">{status.label}</span>
        <span className="ml-auto shrink-0 opacity-80">
          {m.total > 0 ? `${m.done}/${m.total} · ` : ""}{Math.floor(m.presentSecs / 60)}m
        </span>
      </div>
      {!isMe && trouble && !m.away && (
        <p className="absolute inset-x-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white">
          Couldn&apos;t reach {m.name}&apos;s camera on this network — everything else still works.
        </p>
      )}
    </div>
  );
}
