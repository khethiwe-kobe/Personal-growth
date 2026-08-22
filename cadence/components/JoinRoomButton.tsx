"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinFocusRoomAction } from "@/app/actions";

/**
 * Appears on tasks whose category is done in a focus room. Opens the room if
 * nobody has yet, otherwise joins the one already running.
 */
export default function JoinRoomButton({
  taskId, someoneThere,
}: { taskId: number; someoneThere?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    start(async () => {
      const res = await joinFocusRoomAction(taskId);
      // The task rides along so the lobby opens with the one you tapped
      // already chosen — the room itself isn't bound to it.
      if (typeof res === "number") router.push(`/focus/room/${res}?task=${taskId}`);
      else setError(res.error);
    });

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Opening…" : "Join focus room"}
        {someoneThere ? ` · ${someoneThere} here` : ""}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  );
}
