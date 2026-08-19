import { get } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Timetable uploads are strictly owner-only. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const row = await get<{ data: ArrayBuffer; mime: string; filename: string }>(
    "SELECT data, mime, filename FROM timetable_uploads WHERE id=? AND user_id=?",
    [Number(id), user.id]
  );
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `inline; filename="${row.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
