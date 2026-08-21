import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { canSeeRoom, getRoom } from "@/lib/rooms";
import { tasksForDay, categoriesFor } from "@/lib/repo";
import FocusRoom from "@/components/FocusRoom";
import { PageTitle } from "@/components/ui";
import { iceServers } from "@/lib/ice";
import type { TaskRow } from "@/lib/types";

export const metadata = { title: "Focus room" };
export const dynamic = "force-dynamic";

export default async function FocusRoomPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const roomId = Number((await params).id);
  if (!Number.isFinite(roomId) || !(await canSeeRoom(roomId, user.id))) notFound();

  const room = await getRoom(roomId);
  if (!room) notFound();

  // The task this room exists for — the timer and completion bind to it.
  const anchor = room.task_id
    ? await get<TaskRow>("SELECT * FROM tasks WHERE id=?", [room.task_id])
    : undefined;

  const [dayTasks, categories, membership] = await Promise.all([
    tasksForDay(user.id, room.date),
    categoriesFor(user.id),
    get<{ id: number }>(
      "SELECT id FROM focus_room_members WHERE room_id=? AND user_id=? AND left_at IS NULL",
      [roomId, user.id]
    ),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // The session list: this person's own focus-session tasks for the day.
  const sessionTasks = dayTasks.filter(
    (t) =>
      t.focus_room === 1 ||
      (t.category_id !== null && catMap.get(t.category_id)?.focus_room === 1) ||
      t.id === room.task_id
  );

  return (
    <div className="fade-up">
      <PageTitle
        title="Focus room"
        subtitle="Everyone here is working. Leaving the tab is flagged to the room and recorded."
      />
      <FocusRoom
        roomId={room.id}
        meId={user.id}
        anchor={
          anchor
            ? {
                id: anchor.id, name: anchor.name, start_min: anchor.start_min,
                end_min: anchor.end_min, planned_minutes: anchor.planned_minutes,
                completed: anchor.completed,
              }
            : null
        }
        sessionTasks={sessionTasks}
        categories={categories}
        date={room.date}
        ice={iceServers()}
        alreadyIn={!!membership}
      />
    </div>
  );
}
