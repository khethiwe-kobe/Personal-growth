import { get, run } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canSeeRoom, systemMessage } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * The tab-closing beacon. pagehide gives no time for a normal server action,
 * but sendBeacon delivers one last POST — so closing the tab, navigating away
 * or killing the browser marks the person away right now instead of waiting
 * for the heartbeat to go stale.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const roomId = Number((await ctx.params).id);
  if (!Number.isFinite(roomId) || !(await canSeeRoom(roomId, user.id)))
    return new Response(null, { status: 404 });

  const row = await get<{ id: number; present: number }>(
    "SELECT id, present FROM focus_room_members WHERE room_id=? AND user_id=? AND left_at IS NULL",
    [roomId, user.id]
  );
  if (row && row.present === 1) {
    await run(
      `UPDATE focus_room_members
          SET present=0, away_since=datetime('now'), away_count=away_count+1,
              last_seen=datetime('now')
        WHERE id=?`, [row.id]
    );
    await systemMessage(roomId, user.id, `${user.display_name} left the session`);
  }
  return new Response(null, { status: 204 });
}
