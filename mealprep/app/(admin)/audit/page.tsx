import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, fmtDate, Empty } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: Promise<{ entity?: string; q?: string }> }) {
  await requirePermission("audit:view");
  const { entity, q } = await searchParams;
  const where: string[] = ["1=1"]; const params: unknown[] = [];
  if (entity) { where.push("a.entity_type = ?"); params.push(entity); }
  if (q) { where.push("(a.details LIKE ? OR a.action LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const rows = getDb().prepare(`SELECT a.*, u.name AS user FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE ${where.join(" AND ")} ORDER BY a.id DESC LIMIT 300`).all(...params) as { id: number; action: string; entity_type: string; entity_id: number | null; details: string; created_at: string; user: string | null }[];
  const entities = getDb().prepare("SELECT DISTINCT entity_type FROM audit_log ORDER BY 1").all() as { entity_type: string }[];
  return (
    <div>
      <PageHeader kicker="Security" title="Audit log">Every create, update, status change, payment, inventory movement and data-subject action, with the user who performed it.</PageHeader>
      <Card>
        <form className="flex gap-2 mb-4"><select name="entity" defaultValue={entity ?? ""} className="input max-w-[200px]"><option value="">All entities</option>{entities.map((e) => <option key={e.entity_type} value={e.entity_type}>{e.entity_type}</option>)}</select><input name="q" defaultValue={q ?? ""} placeholder="Search" className="input max-w-xs" /><button className="btn-secondary">Filter</button></form>
        {rows.length === 0 ? <Empty>No entries.</Empty> : <table className="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="text-xs">{fmtDate(r.created_at)}</td><td className="text-xs">{r.user ?? "system"}</td><td className="text-xs font-mono">{r.action}</td><td className="text-xs">{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ""}</td><td className="text-xs text-ink-2">{r.details}</td></tr>)}</tbody></table>}
      </Card>
    </div>
  );
}
