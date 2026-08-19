import { get } from "@/lib/db";
import { getSessionUser, getGroupForUser } from "@/lib/auth";

/** Avatars are visible to the owner and their group members only. */
export async function GET(
  _req: Request,
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
  return new Response(new Uint8Array(row.avatar_blob), {
    headers: {
      "Content-Type": row.avatar_mime ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
