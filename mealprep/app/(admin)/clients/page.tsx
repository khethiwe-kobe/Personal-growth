import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listClients } from "@/lib/repo/clients";
import { PageHeader, Card, StatusBadge, fmtDate, Empty } from "@/components/ui";

export default async function Clients({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePermission("clients:view");
  const { status, q } = await searchParams;
  const rows = listClients({ status, q });
  return (
    <div>
      <PageHeader kicker="CRM" title="Clients" actions={<Link href="/onboard" className="btn-primary">Onboard a client</Link>}>{rows.length} clients{status ? ` · ${status}` : ""}</PageHeader>
      <Card>
        <form className="flex flex-wrap gap-2 mb-4">
          <input name="q" defaultValue={q ?? ""} placeholder="Search name or email" className="input max-w-xs" />
          <select name="status" defaultValue={status ?? ""} className="input max-w-[160px]"><option value="">All statuses</option>{["lead", "onboarding", "active", "paused", "churned"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <button className="btn-secondary">Filter</button>
        </form>
        {rows.length === 0 ? <Empty>No clients match.</Empty> : (
          <table className="table">
            <thead><tr><th>Client</th><th>Status</th><th>Contact</th><th>Orders</th><th>Last delivery</th><th>Registered</th><th></th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.first_name} {c.last_name}</Link>{c.review_flag ? <span className="badge bg-amber-100 text-amber-900 ml-2">review</span> : null}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="text-ink-2 text-xs">{c.email}<br />{c.phone}</td>
                <td>{c.orders}</td><td>{fmtDate(c.last_order)}</td><td>{fmtDate(c.registered_at)}</td>
                <td><Link href={`/clients/${c.id}`} className="btn-ghost btn-sm">Open</Link></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
