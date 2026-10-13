import { bad, json, readJson, withMember } from "@/lib/server/http";
import { postExists, toggleReaction } from "@/lib/server/social";
import { REACTIONS } from "@/lib/types";

export const runtime = "nodejs";

/** Toggle one of the fixed reactions on a post. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async (me) => {
    const { id } = await ctx.params;
    const body = await readJson<{ kind?: unknown }>(req);
    const kind = String(body?.kind ?? "");
    if (!REACTIONS.some((r) => r.id === kind)) return bad("Unknown reaction.");
    if (!(await postExists(id))) return bad("That post no longer exists.", 404);
    await toggleReaction(id, me.id, kind);
    return json({ ok: true });
  });
}
