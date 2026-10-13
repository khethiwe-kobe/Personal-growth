import { bad, json, withMember } from "@/lib/server/http";
import { commentOwner, deleteComment } from "@/lib/server/social";

export const runtime = "nodejs";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async (me) => {
    const { id } = await ctx.params;
    const owner = await commentOwner(id);
    if (!owner) return bad("That comment no longer exists.", 404);
    if (owner !== me.id && !me.isAdmin) return bad("You can only delete your own comments.", 403);
    await deleteComment(id);
    return json({ ok: true });
  });
}
