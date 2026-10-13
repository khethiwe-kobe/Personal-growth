import { bad, json, withMember } from "@/lib/server/http";
import { deletePost, postOwner } from "@/lib/server/social";

export const runtime = "nodejs";

/** Authors can delete their own posts; the group admin can delete any. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async (me) => {
    const { id } = await ctx.params;
    const owner = await postOwner(id);
    if (!owner) return bad("That post no longer exists.", 404);
    if (owner !== me.id && !me.isAdmin) return bad("You can only delete your own posts.", 403);
    await deletePost(id);
    return json({ ok: true });
  });
}
