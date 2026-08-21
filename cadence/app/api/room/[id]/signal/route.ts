import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * Connection setup only.
 *
 * The video itself goes straight between devices; this passes the small
 * handshake messages needed to establish that. Messages are addressed to one
 * person, deleted once collected, and swept after an hour.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const roomId = Number((await ctx.params).id);
  if (!Number.isFinite(roomId) || !(await canSeeRoom(roomId, user.id)))
    return new Response("Not found", { status: 404 });

  const rows = await all<{ id: number; from_user: number; payload: string }>(
    `SELECT id, from_user, payload FROM focus_room_signals
      WHERE room_id=? AND to_user=? ORDER BY id LIMIT 60`,
    [roomId, user.id]
  );
  if (rows.length) {
    await run(
      `DELETE FROM focus_room_signals WHERE id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.id)
    );
  }
  return Response.json(
    { signals: rows.map((r) => ({ from: r.from_user, payload: JSON.parse(r.payload) })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const roomId = Number((await ctx.params).id);
  if (!Number.isFinite(roomId) || !(await canSeeRoom(roomId, user.id)))
    return new Response("Not found", { status: 404 });

  const body = (await req.json()) as { to?: number; payload?: unknown };
  const to = Number(body.to);
  if (!Number.isFinite(to) || !body.payload) return new Response("Bad request", { status: 400 });
  // Only to someone who can see this room — never a stranger's id.
  if (!(await canSeeRoom(roomId, to))) return new Response("Not found", { status: 404 });

  const payload = JSON.stringify(body.payload).slice(0, 20000);
  await run(
    "INSERT INTO focus_room_signals (room_id, from_user, to_user, payload) VALUES (?,?,?,?)",
    [roomId, user.id, to, payload]
  );
  await run(
    "DELETE FROM focus_room_signals WHERE created_at < datetime('now', '-1 hour')"
  );
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
