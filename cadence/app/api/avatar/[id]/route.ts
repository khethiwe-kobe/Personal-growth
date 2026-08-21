import crypto from "crypto";
import { get } from "@/lib/db";
import { getSessionUser, getGroupForUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Avatars are visible to the owner and their group members only.
 *
 * The URL for a person's picture never changes, so a plain max-age meant a new
 * photo kept showing the old one until the cache expired. The response now
 * carries a tag derived from the bytes and asks the browser to revalidate:
 * unchanged pictures cost a 304, a new one is picked up immediately.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) return new Response("Bad request", { status: 400 });
  if (targetId !== user.id) {
    const group = await getGroupForUser(user.id);
    if (!group || !group.members.some((m) => m.id === targetId))
      return new Response("Forbidden", { status: 403 });
  }
  const row = await get<{ avatar_blob: ArrayBuffer | null; avatar_mime: string | null }>(
    "SELECT avatar_blob, avatar_mime FROM users WHERE id=?", [targetId]
  );
  if (!row?.avatar_blob) return new Response("Not found", { status: 404 });

  const bytes = new Uint8Array(row.avatar_blob);
  const etag =
    '"' + crypto.createHash("sha1").update(bytes).digest("base64url").slice(0, 20) + '"';
  const headers = {
    "Content-Type": row.avatar_mime ?? "image/jpeg",
    "Cache-Control": "private, no-cache",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(bytes, { headers });
}
