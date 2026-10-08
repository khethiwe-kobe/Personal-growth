import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listPlans } from "@/lib/repo/orders";
import { PageHeader, Card, StatusBadge, fmtDate, Empty } from "@/components/ui";

export default async function Plans({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("plans:view");
  const { status } = await searchParams;
  const rows = listPlans().filter((p) => !status || p.status === status);
  return (
    <div>
      <PageHeader kicker="Planning" title="Weekly meal plans" actions={<Link href="/meal-plans/new" className="btn-primary">Generate a plan</Link>}>Draft → proposed (client notified) → approved (by client) → ordered.</PageHeader>
      <Card>
        <div className="flex gap-1 mb-4 flex-wrap">{["", "draft", "proposed", "approved", "ordered", "archived"].map((s) => <Link key={s} href={s ? `/meal-plans?status=${s}` : "/meal-plans"} className={`badge ${status === s || (!status && !s) ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{s || "all"}</Link>)}</div>
        {rows.length === 0 ? <Empty>No plans.</Empty> : <table className="table"><thead><tr><th>Client</th><th>Week of</th><th>Items</th><th>Goal</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td className="font-medium">{p.client_name}</td><td>{fmtDate(p.week_start)}</td><td>{p.items}</td><td className="text-xs text-ink-2">{p.goal_type.replace(/_/g, " ")}</td><td><StatusBadge status={p.status} /></td><td className="text-xs text-ink-2">{fmtDate(p.created_at)}</td><td><Link href={`/meal-plans/${p.id}`} className="btn-ghost btn-sm">Open</Link></td></tr>)}</tbody></table>}
      </Card>
    </div>
  );
}
