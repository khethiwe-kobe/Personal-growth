"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableFocusCategoryAction } from "@/app/actions";
import { Button, Card } from "./ui";
import JoinRoomButton from "./JoinRoomButton";
import { fmtClock } from "@/lib/time";

/**
 * The way into a focus room. Without this the room was only reachable from a
 * task already in a room category, which meant it looked like it didn't exist.
 */
export default function FocusRoomsPanel({
  openRooms, tasks, hasCategory,
}: {
  openRooms: { id: number; title: string; date: string; here: string[] }[];
  tasks: { id: number; name: string; start_min: number | null; completed: number }[];
  hasCategory: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!hasCategory && openRooms.length === 0) {
    return (
      <Card>
        <h3 className="font-display text-lg font-medium">Focus room</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Work through something at the same time as the others: cameras on, no microphones,
          a shared chat, and everyone&apos;s progress visible. A task in a focus category can
          only be ticked once you&apos;ve actually turned up — the room is the proof.
        </p>
        <Button
          className="mt-3"
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await enableFocusCategoryAction(); router.refresh(); })}
        >
          {pending ? "Setting up…" : "Set up a focus category"}
        </Button>
        <p className="mt-2 text-[11px] text-ink-3">
          Creates a “Focus session” category. Put a task in it on Today and a
          <strong> Join focus room</strong> button appears on it. You can also walk
          straight in from the <strong>Focus Room</strong> tab at any time.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <h3 className="mb-2 font-display text-lg font-medium">The room</h3>
        {openRooms.length === 0 ? (
          <p className="text-sm text-ink-3">
            Nobody has the room open. Open it from the{" "}
            <strong>Focus Room</strong> tab, or from a focus task below.
          </p>
        ) : (
          <ul className="space-y-2">
            {openRooms.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {r.here.length
                    ? `${r.here.join(", ")} ${r.here.length === 1 ? "is" : "are"} in the room`
                    : "Room open · nobody in it"}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/focus/room/${r.id}`)}
                  className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink"
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-lg font-medium">Today&apos;s room sessions</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-3">
            Nothing today in a focus category. Add a task on Today and pick your focus
            category — a Join button appears on it.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {t.name}
                  {t.start_min !== null && (
                    <span className="ml-1 text-ink-3">{fmtClock(t.start_min)}</span>
                  )}
                </span>
                {t.completed ? (
                  <span className="shrink-0 text-[11px] text-ok">done</span>
                ) : (
                  <JoinRoomButton taskId={t.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
