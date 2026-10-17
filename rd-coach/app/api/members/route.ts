import { json, withMember } from "@/lib/server/http";
import { sql } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everyone in the group. */
export async function GET(req: Request) {
  return withMember(req, async () => {
    const rows = await sql<{ id: string; username: string; display_name: string; is_admin: boolean; created_at: string }>(
      "SELECT id, username, display_name, is_admin, created_at FROM members WHERE NOT removed ORDER BY display_name",
    );
    return json({
      members: rows.map((r) => ({ id: r.id, username: r.username, name: r.display_name, isAdmin: r.is_admin, joinedAt: new Date(r.created_at).toISOString() })),
    });
  });
}
