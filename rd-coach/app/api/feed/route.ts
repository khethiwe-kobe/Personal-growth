import { json, withMember } from "@/lib/server/http";
import { cursorOf, feed } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The team feed, newest first. ?before=<cursor> pages back; ?member=<id> filters to one person. */
export async function GET(req: Request) {
  return withMember(req, async (me) => {
    const url = new URL(req.url);
    const before = url.searchParams.get("before") ?? undefined;
    const memberId = url.searchParams.get("member") ?? undefined;
    const { posts, more } = await feed(me.id, { before, memberId });
    return json({ posts, next: more && posts.length ? cursorOf(posts[posts.length - 1]) : null });
  });
}
