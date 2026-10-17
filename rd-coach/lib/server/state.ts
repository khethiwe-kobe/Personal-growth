import { sql } from "./db";
import { joinState, splitState } from "../state";
import { EMPTY_STATE, type CoachState, type PublicProgress } from "../types";

export type StoredState = { state: CoachState; version: number };

export async function loadState(memberId: string): Promise<StoredState> {
  const rows = await sql<{ private: unknown; public: unknown; version: number }>(
    "SELECT private, public, version FROM member_state WHERE member_id = $1",
    [memberId],
  );
  if (!rows[0]) return { state: { ...EMPTY_STATE, createdAt: new Date().toISOString() }, version: 0 };
  return { state: joinState(rows[0].private, rows[0].public), version: rows[0].version };
}

export async function saveState(memberId: string, state: CoachState): Promise<number> {
  const { priv, pub } = splitState(state);
  const rows = await sql<{ version: number }>(
    `INSERT INTO member_state (member_id, private, public, version, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, 1, now())
     ON CONFLICT (member_id) DO UPDATE
       SET private = EXCLUDED.private, public = EXCLUDED.public,
           version = member_state.version + 1, updated_at = now()
     RETURNING version`,
    [memberId, JSON.stringify(priv), JSON.stringify(pub)],
  );
  return rows[0].version;
}

export type MemberPublic = { id: string; name: string; joinedAt: string; progress: PublicProgress };

/** Every active member's shared progress, for the scoreboard and member pages. */
export async function allPublicProgress(): Promise<MemberPublic[]> {
  const rows = await sql<{ id: string; display_name: string; created_at: string; public: unknown }>(
    `SELECT m.id, m.display_name, m.created_at, s.public
       FROM members m LEFT JOIN member_state s ON s.member_id = m.id
      WHERE NOT m.removed
      ORDER BY m.display_name`,
  );
  return rows.map((r) => {
    const st = joinState({}, r.public ?? {});
    return {
      id: r.id,
      name: r.display_name,
      joinedAt: new Date(r.created_at).toISOString(),
      progress: { programme: st.programme, logs: st.logs, metrics: st.metrics },
    };
  });
}
