import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { canSeeRoom, getRoom } from "@/lib/rooms";
import { tasksForDay } from "@/lib/repo";
import FocusRoom from "@/components/FocusRoom";
import { PageTitle } from "@/components/ui";
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

  // The session list is this person's own tasks for the day in the same
  // category as the room's task — their list, not anyone else's.
  const anchor = room.task_id
    ? await get<TaskRow>("SELECT * FROM tasks WHERE id=?", [room.task_id])
    : undefined;
  const dayTasks = await tasksForDay(user.id, room.date);
  const sessionTasks = anchor?.category_id
    ? dayTasks.filter((t) => t.category_id === anchor.category_id)
    : dayTasks.filter((t) => t.id === room.task_id);

  return (
    <div className="fade-up">
      <PageTitle
        title={room.title}
        subtitle="Everyone here is working. Leaving the tab is flagged to the room."
      />
      <FocusRoom
        roomId={room.id}
        title={room.title}
        meId={user.id}
        sessionTasks={sessionTasks}
      />
    </div>
  );
}
