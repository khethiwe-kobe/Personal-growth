"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  roomHeartbeatAction, leaveFocusRoomAction, roomSayAction, roomProgressAction,
  toggleTaskAction, enterFocusRoomAction,
} from "@/app/actions";
import { Button } from "./ui";
import { IconCheck, IconX } from "./icons";
import type { TaskRow } from "@/lib/types";

type Member = {
  userId: number; name: string; accent: string; hasAvatar: boolean;
  here: boolean; away: boolean; gone: boolean; awayCount: number;
  presentSecs: number; done: number; total: number; sharesList: boolean;
};
type Message = { id: number; userId: number; name: string; body: string; kind: string; at: string };

const HEARTBEAT_MS = 10_000;
const POLL_MS = 2_500;
const SIGNAL_MS = 1_500;

// Public STUN only: the video goes straight between devices, so nothing but
// the connection handshake ever leaves them.
const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};

export default function FocusRoom({
  roomId, title, meId, sessionTasks,
}: {
  roomId: number;
  title: string;
  meId: number;
  sessionTasks: TaskRow[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [immersive, setImmersive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [peerTrouble, setPeerTrouble] = useState<number[]>([]);
  const [shareList, setShareList] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>(
    () => Object.fromEntries(sessionTasks.map((t) => [t.id, !!t.completed]))
  );

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peers = useRef<Map<number, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<number, MediaStream>>(new Map());
  const [, forceRender] = useState(0);
  const lastMsgId = useRef(0);
  const started = useRef(Date.now());

  const me = members.find((m) => m.userId === meId);
  const others = members.filter((m) => m.userId !== meId && !m.gone);

  // ---- camera (video only: no microphone is ever requested) ----
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        forceRender((n) => n + 1);
      })
      .catch(() => setCamError("No camera available — you'll join without video."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ---- signalling ----
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

  const peerFor = useCallback(
    (otherId: number) => {
      const existing = peers.current.get(otherId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE);
      peers.current.set(otherId, pc);
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

      pc.ontrack = (e) => {
        remoteStreams.current.set(otherId, e.streams[0]);
        forceRender((n) => n + 1);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(otherId, { candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        // Without a relay some networks simply cannot connect the two devices.
        // Say so plainly rather than showing an empty tile forever.
        if (pc.connectionState === "failed") {
          setPeerTrouble((prev) => (prev.includes(otherId) ? prev : [...prev, otherId]));
        } else if (pc.connectionState === "connected") {
          setPeerTrouble((prev) => prev.filter((id) => id !== otherId));
        }
      };
      return pc;
    },
    [send]
  );

  // Lower id always makes the offer, so two people never offer at once.
  const shouldOffer = useCallback((otherId: number) => meId < otherId, [meId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/signal`);
        if (!res.ok) return;
        const { signals } = (await res.json()) as {
          signals: { from: number; payload: Record<string, unknown> }[];
        };
        for (const s of signals) {
          const pc = peerFor(s.from);
          if (s.payload.description) {
            const desc = s.payload.description as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(desc);
            if (desc.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              void send(s.from, { description: pc.localDescription });
            }
          } else if (s.payload.candidate) {
            await pc.addIceCandidate(s.payload.candidate as RTCIceCandidateInit).catch(() => {});
          }
        }
      } catch { /* keep polling */ }
      if (!stop) setTimeout(tick, SIGNAL_MS);
    };
    tick();
    return () => { stop = true; };
  }, [roomId, peerFor, send]);

  // Offer to anyone new in the room.
  useEffect(() => {
    for (const other of others) {
      if (peers.current.has(other.userId) || !shouldOffer(other.userId)) continue;
      const pc = peerFor(other.userId);
      void (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void send(other.userId, { description: pc.localDescription });
      })();
    }
  }, [others, peerFor, send, shouldOffer]);

  // ---- room state ----
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/state?since=${lastMsgId.current}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members);
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
  }, [roomId]);

  // ---- presence: leaving the tab is reported at once ----
  useEffect(() => {
    const beat = (present: boolean) => { void roomHeartbeatAction(roomId, present); };
    // Opening the page is joining, however you got here.
    void enterFocusRoomAction(roomId).then(() => beat(true));
    const timer = setInterval(() => beat(document.visibilityState === "visible"), HEARTBEAT_MS);
    const onVis = () => beat(document.visibilityState === "visible");
    const onLeave = () => {
      // Fire-and-forget so the flag lands even as the page goes away.
      navigator.sendBeacon?.(`/api/room/${roomId}/state`);
      beat(false);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [roomId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const doneCount = useMemo(() => Object.values(done).filter(Boolean).length, [done]);
  useEffect(() => {
    void roomProgressAction(roomId, doneCount, sessionTasks.length, shareList);
  }, [roomId, doneCount, sessionTasks.length, shareList]);

  const toggleTask = (t: TaskRow) => {
    const next = !done[t.id];
    setDone((d) => ({ ...d, [t.id]: next }));
    void toggleTaskAction(t.id, next).then((res) => {
      if (res && "error" in res) setDone((d) => ({ ...d, [t.id]: !next }));
    });
  };

  const say = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void roomSayAction(roomId, text);
  };

  const leave = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    peers.current.forEach((pc) => pc.close());
    await leaveFocusRoomAction(roomId);
    router.push("/focus");
  };

  const Tile = ({ m }: { m: Member }) => {
    const isMe = m.userId === meId;
    const stream = remoteStreams.current.get(m.userId);
    const trouble = peerTrouble.includes(m.userId);
    return (
      <div className={`relative overflow-hidden rounded-2xl border bg-surface-2 ${
        m.away ? "border-danger" : "border-line"
      }`}>
        <video
          autoPlay playsInline muted={isMe}
          ref={(el) => {
            if (!el) return;
            if (isMe) { if (streamRef.current) el.srcObject = streamRef.current; }
            else if (stream && el.srcObject !== stream) el.srcObject = stream;
          }}
          className="aspect-video w-full bg-black/80 object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/45 px-2 py-1 text-[11px] text-white">
          <span className="truncate font-medium">{m.name}{isMe ? " (you)" : ""}</span>
          {m.total > 0 && <span className="shrink-0 opacity-90">{m.done}/{m.total}</span>}
          {m.away && <span className="ml-auto shrink-0 font-medium text-danger">left the session</span>}
        </div>
        {!isMe && trouble && !m.away && (
          <p className="absolute inset-x-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white">
            Couldn&apos;t reach {m.name}&apos;s camera on this network — everything else still works.
          </p>
        )}
      </div>
    );
  };

  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {me && <Tile m={me} />}
        {others.map((m) => <Tile key={m.userId} m={m} />)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">This session</h3>
            <span className="text-[11px] text-ink-3">{doneCount}/{sessionTasks.length}</span>
          </div>
          <ul className="space-y-1">
            {sessionTasks.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => toggleTask(t)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    done[t.id] ? "border-transparent bg-accent text-white" : "border-line"
                  }`}>
                    {done[t.id] && <IconCheck size={11} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${done[t.id] ? "text-ink-3 line-through" : ""}`}>
                    {t.name}
                  </span>
                </button>
              </li>
            ))}
            {sessionTasks.length === 0 && (
              <li className="px-2 py-1 text-xs text-ink-3">Nothing else planned for this session.</li>
            )}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-ink-2">
            <input type="checkbox" checked={shareList}
              onChange={(e) => setShareList(e.target.checked)} />
            Let the others see the items, not just the count
          </label>
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Room chat</h3>
          <ul className="mb-2 max-h-56 flex-1 space-y-1 overflow-y-auto text-xs">
            {messages.map((m) => (
              <li key={m.id} className={m.kind === "system" ? "text-ink-3 italic" : ""}>
                {m.kind === "system" ? m.body : <><span className="font-medium">{m.name}:</span> {m.body}</>}
              </li>
            ))}
            {messages.length === 0 && <li className="text-ink-3">Say something to the room.</li>}
          </ul>
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); say(); } }}
              placeholder="Message the room…" maxLength={500} className="flex-1 text-sm" />
            <button type="button" onClick={say}
              className="rounded-lg border border-line px-3 text-sm text-ink-2">Send</button>
          </div>
        </div>
      </div>
    </>
  );

  if (immersive) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-bg px-5 py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-3">Focus room</p>
            <h2 className="font-display text-xl font-medium">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-medium tabular-nums">{clock(elapsed)}</span>
            <button type="button" onClick={() => setImmersive(false)}
              className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2">
              Exit full screen
            </button>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">
            Camera on, microphone never requested. Present {clock(elapsed)}.
          </p>
          {camError && <p className="text-[11px] text-danger">{camError}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" type="button" onClick={() => setImmersive(true)}>Full screen</Button>
          <Button variant="danger" type="button" onClick={leave}>
            <IconX size={14} /> Leave room
          </Button>
        </div>
      </div>
      {body}
    </div>
  );
}
