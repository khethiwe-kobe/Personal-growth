"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinFocusRoomAction } from "@/app/actions";
import { Button } from "./ui";

/**
 * Opens the group's focus room from the Focus Room tab. Picking a task here is
 * optional — the room exists whether or not you have one planned, and the task
 * you choose stays yours.
 */
export default function OpenRoomButton({
  tasks,
}: { tasks: { id: number; name: string; completed: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [taskId, setTaskId] = useState<string>(
    String(tasks.find((t) => !t.completed)?.id ?? "")
  );
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    start(async () => {
      setError(null);
      const res = await joinFocusRoomAction(taskId ? Number(taskId) : null);
      if (typeof res === "number") router.push(`/focus/room/${res}`);
      else setError(res.error);
    });

  return (
    <div className="mt-4">
      {tasks.length > 0 && (
        <label className="mb-3 block">
          <span className="text-[11px] text-ink-3">Working on (optional)</span>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">Just focusing — nothing specific</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.completed ? " (done)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="button" onClick={go} disabled={pending} className="w-full">
        {pending ? "Opening…" : "Open the focus room"}
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
