import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmtDate, PageHeader, Card, Empty } from "@/components/ui";
import Link from "next/link";

export default async function Notifications() {
  const user = await requireUser();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100").all(user.id) as { id: number; title: string; body: string; link: string; read_at: string | null; created_at: string }[];
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
  return (
    <div className="max-w-3xl mx-auto p-6">
      <PageHeader title="Notifications" actions={<Link href={user.role === "client" ? "/portal" : "/dashboard"} className="btn-secondary btn-sm">Back</Link>} />
      <Card>
        {rows.length === 0 ? <Empty>No notifications yet.</Empty> : (
          <ul className="divide-y divide-line">
            {rows.map((n) => <li key={n.id} className="py-3"><div className="flex justify-between gap-3"><div><div className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>{n.title}</div><div className="text-xs text-ink-2">{n.body}</div></div><div className="text-[11px] text-ink-3 whitespace-nowrap">{fmtDate(n.created_at)}</div></div>{n.link && <Link href={n.link} className="text-xs text-accent">Open →</Link>}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
