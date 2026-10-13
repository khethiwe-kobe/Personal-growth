import { bad, withMember } from "@/lib/server/http";
import { getPhoto } from "@/lib/server/social";

export const runtime = "nodejs";

/** Progress photos are only served to signed-in members of the group. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMember(req, async () => {
    const { id } = await ctx.params;
    const photo = await getPhoto(id);
    if (!photo) return bad("Photo not found.", 404);
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.mime,
        // Photo ids never change content; keep them in the member's browser only.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  });
}
