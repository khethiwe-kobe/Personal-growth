import { bad, json, withMember } from "@/lib/server/http";
import { sql } from "@/lib/server/db";
import { photoDays } from "@/lib/server/social";
import { allPublicProgress } from "@/lib/server/state";
import { scoreMember } from "@/lib/scoring";
import { dayOf } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One member's shared progress: programme, sessions, tests and scores. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async () => {
    const { id } = await ctx.params;
    const member = (await allPublicProgress()).find((m) => m.id === id);
    if (!member) return bad("Member not found.", 404);
    const days = (await photoDays()).get(id) ?? [];
    const today = dayOf();
    const p = { id, name: member.name, ...member.progress, photoDays: days };
    return json({
      member: { id, name: member.name, joinedAt: member.joinedAt },
      progress: member.progress,
      week: scoreMember(p, "week", today),
      all: scoreMember(p, "all", today),
    });
  });
}

/** The group admin can remove someone; they are signed out and hidden from the group. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async (me) => {
    const { id } = await ctx.params;
    if (!me.isAdmin) return bad("Only the group admin can remove members.", 403);
    if (id === me.id) return bad("You cannot remove yourself.");
    await sql("UPDATE members SET removed = TRUE WHERE id = $1", [id]);
    await sql("DELETE FROM sessions WHERE member_id = $1", [id]);
    return json({ ok: true });
  });
}
