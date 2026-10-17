import { bad, json, readJson, withMember } from "@/lib/server/http";
import { addComment, postExists } from "@/lib/server/social";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async (me) => {
    const { id } = await ctx.params;
    const body = await readJson<{ body?: unknown }>(req);
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) return bad("Write a comment first.");
    if (text.length > 1000) return bad("Keep comments under 1000 characters.");
    if (!(await postExists(id))) return bad("That post no longer exists.", 404);
    const comment = await addComment(id, me.id, me.name, text);
    return json({ comment });
  });
}
