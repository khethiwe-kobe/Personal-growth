import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listOrders } from "@/lib/repo/orders";
import { PageHeader, Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { ORDER_STATUSES } from "@/lib/types";

const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: "inquiry", label: "Inquiry / Quote", statuses: ["inquiry", "quote_sent"] },
  { key: "payment", label: "Awaiting payment", statuses: ["awaiting_payment"] },
  { key: "paid", label: "Paid / Planned", statuses: ["paid", "plan_created", "shopping"] },
  { key: "kitchen", label: "In kitchen", statuses: ["preparing", "packaging"] },
  { key: "ready", label: "Ready", statuses: ["ready"] },
  { key: "delivery", label: "Out for delivery", statuses: ["out_for_delivery"] },
  { key: "done", label: "Delivered", statuses: ["delivered", "completed"] },
];

export default async function Orders({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string; from?: string; to?: string }> }) {
  await requirePermission("orders:view");
  const { view = "board", status, q, from, to } = await searchParams;
  const rows = listOrders({ status, q, from, to });
  return (
    <div>
      <PageHeader kicker="Operations" title="Orders" actions={<><Link href="/orders?view=board" className={`btn-secondary btn-sm ${view === "board" ? "!bg-ink !text-white" : ""}`}>Board</Link><Link href="/orders?view=table" className={`btn-secondary btn-sm ${view === "table" ? "!bg-ink !text-white" : ""}`}>Table</Link><Link href="/api/export/orders" className="btn-secondary btn-sm">CSV</Link></>}>Orders are created from approved meal plans. Payment moves them into production; production and delivery update them automatically.</PageHeader>
      {view === "board" ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-7 gap-3 overflow-x-auto">
          {COLUMNS.map((col) => { const items = rows.filter((o) => col.statuses.includes(o.status) && (col.key !== "done" || o.delivery_date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))); return (
            <div key={col.key} className="card p-3 min-h-[200px]">
              <div className="flex justify-between items-center mb-2"><div className="kicker">{col.label}</div><span className="badge bg-bone-2 text-ink-2">{items.length}</span></div>
              <div className="space-y-2">{items.slice(0, 15).map((o) => <Link key={o.id} href={`/orders/${o.id}`} className="block rounded-lg border border-line p-2 hover:border-accent"><div className="text-xs font-medium">{o.client_name}</div><div className="text-[11px] text-ink-2">{o.order_number} · {o.meals} meals</div><div className="text-[11px] text-ink-3">{fmtDate(o.delivery_date)} · {formatZar(o.total_zar)}</div><div className="mt-1"><StatusBadge status={o.status} /></div></Link>)}{items.length > 15 && <div className="text-xs text-ink-3">+{items.length - 15} more</div>}</div>
            </div>); })}
        </div>
      ) : (
        <Card>
          <form className="flex flex-wrap gap-2 mb-4"><input type="hidden" name="view" value="table" /><input name="q" defaultValue={q ?? ""} placeholder="Order # or client" className="input max-w-xs" /><select name="status" defaultValue={status ?? ""} className="input max-w-[180px]"><option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select><input name="from" type="date" defaultValue={from ?? ""} className="input max-w-[150px]" /><input name="to" type="date" defaultValue={to ?? ""} className="input max-w-[150px]" /><button className="btn-secondary">Filter</button></form>
          {rows.length === 0 ? <Empty>No orders.</Empty> : <table className="table"><thead><tr><th>Order</th><th>Client</th><th>Delivery</th><th>Meals</th><th>Total</th><th>Payment</th><th>Status</th><th>Delivery</th></tr></thead><tbody>{rows.map((o) => <tr key={o.id}><td><Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.order_number}</Link></td><td>{o.client_name}</td><td>{fmtDate(o.delivery_date)}</td><td>{o.meals}</td><td>{formatZar(o.total_zar)}</td><td><StatusBadge status={o.payment_status} /></td><td><StatusBadge status={o.status} /></td><td>{o.delivery_status ? <StatusBadge status={o.delivery_status} /> : "—"}</td></tr>)}</tbody></table>}
        </Card>
      )}
    </div>
  );
}
