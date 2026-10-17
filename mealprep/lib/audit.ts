import { getDb } from "./db";

export async function audit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details: string = ""
) {
  await getDb()
    .prepare(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)"
    )
    .run(userId, action, entityType, entityId, details.slice(0, 2000));
}
