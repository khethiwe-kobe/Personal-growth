import { redirect } from "next/navigation";
import { requireUser, getGroupForUser } from "@/lib/auth";
import { openRoomForGroup, focusRoomTasksToday } from "@/lib/rooms";
import { safeTz, todayInTz } from "@/lib/time";
import { PageTitle, Card } from "@/components/ui";
import OpenRoomButton from "@/components/OpenRoomButton";

/**
 * The Focus Room tab: one press away, from anywhere.
 *
 * If the group already has a room open this goes straight into it — landing in
 * the lobby, not in a seat, so turning up is still a decision. If nobody has
 * one open, this is where you open it.
 */
export const metadata = { title: "Focus room" };
export const dynamic = "force-dynamic";

export default async function FocusRoomEntry() {
  const user = await requireUser();
  const group = await getGroupForUser(user.id);

  if (group) {
    const open = await openRoomForGroup(group.group.id);
    if (open) redirect(`/focus/room/${open.id}`);
  }

  const today = todayInTz(safeTz(user.timezone));
  const tasks = group ? await focusRoomTasksToday(user.id, today) : [];

  return (
    <div className="fade-up mx-auto max-w-lg">
      <PageTitle
        title="Focus room"
        subtitle="Sit down with the others and work. Cameras on, no microphones."
      />
      <Card>
        {!group ? (
          <p className="text-sm leading-relaxed text-ink-2">
            You&apos;re not in an accountability group yet, so there&apos;s nobody to sit
            with. Join one from Profile &amp; Settings and the room opens up.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-2">
              Nobody has the room open right now. Open it and the others can walk
              straight in from this same tab — everyone lands in the same room.
            </p>
            <OpenRoomButton tasks={tasks} />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              The room isn&apos;t named after anyone&apos;s work. You pick what you&apos;re
              working on for yourself on the way in, and only you can see it.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
