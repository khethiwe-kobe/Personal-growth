import { requireUser } from "@/lib/auth";
import { canSeeRoom, getRoom, roomMembers, roomMessages, AWAY_AFTER_SECONDS } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * Everything the room UI redraws itself from: who is here, who has slipped
 * away, how far through their list each person is, and any new chat.
 *
 * Only the count of someone's list is shared unless they opted to share the
 * items, and never anything outside this room.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const roomId = Number((await ctx.params).id);
  if (!Number.isFinite(roomId) || !(await canSeeRoom(roomId, user.id)))
    return new Response("Not found", { status: 404 });

  const since = Number(new URL(req.url).searchParams.get("since") ?? 0) || 0;
  const [room, members, messages] = await Promise.all([
    getRoom(roomId),
    roomMembers(roomId),
    roomMessages(roomId, since),
  ]);

  return Response.json(
    {
      room: room ? { id: room.id, title: room.title, date: room.date } : null,
      me: user.id,
      members: members.map((m) => ({
        userId: m.user_id,
        name: m.display_name,
        accent: m.accent,
        hasAvatar: !!m.has_avatar,
        // "here" needs a recent heartbeat as well as a visible tab, so a
        // closed laptop shows as gone rather than lingering as present.
        here: m.left_at === null && m.present === 1 && !m.stale,
        away: m.left_at === null && (m.present === 0 || m.stale),
        gone: m.left_at !== null,
        awayCount: m.away_count,
        awaySecs: m.away_secs,
        presentSecs: m.present_secs,
        cameraOn: !!m.camera_on,
        interruptions: m.interruptions,
        done: m.tasks_done,
        total: m.tasks_total,
        sharesList: !!m.share_list,
      })),
      messages: messages.map((msg) => ({
        id: msg.id, userId: msg.user_id, name: msg.display_name,
        body: msg.body, kind: msg.kind, at: msg.created_at,
      })),
      awayAfter: AWAY_AFTER_SECONDS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
