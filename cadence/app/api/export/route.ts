import { all, get } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Downloads everything the signed-in user owns as one JSON file — including
 * the private fields (notes, a goal's "why", reflections), because this is
 * their own data. Never includes anyone else's rows or any password hash.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const mine = <T>(sql: string) => all<T>(sql, [user.id]);

  const [
    profile, categories, tasks, time_blocks, goals, goal_checkins,
    calendar_events, timetable_entries, focus_sessions, monthly_reviews,
  ] = await Promise.all([
    get(
      `SELECT id, username, display_name, email, role, bio, timezone, appearance,
              accent, created_at FROM users WHERE id = ?`,
      [user.id]
    ),
    mine("SELECT * FROM categories WHERE user_id = ? ORDER BY position, id"),
    mine("SELECT * FROM tasks WHERE user_id = ? ORDER BY date, id"),
    mine("SELECT * FROM time_blocks WHERE user_id = ? ORDER BY date, start_min"),
    mine("SELECT * FROM goals WHERE user_id = ? ORDER BY id"),
    mine("SELECT * FROM goal_checkins WHERE user_id = ? ORDER BY goal_id, date"),
    mine("SELECT * FROM calendar_events WHERE user_id = ? ORDER BY date, id"),
    mine("SELECT * FROM timetable_entries WHERE user_id = ? ORDER BY day_of_week, start_min"),
    mine("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY started_at"),
    mine("SELECT * FROM monthly_reviews WHERE user_id = ? ORDER BY month"),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    format_version: 1,
    profile, categories, tasks, time_blocks, goals, goal_checkins,
    calendar_events, timetable_entries, focus_sessions, monthly_reviews,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cadence-${user.username}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
