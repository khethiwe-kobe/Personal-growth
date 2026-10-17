import { requirePermission, can } from "@/lib/auth";
import { listSubscriptions, listPackages, subscriptionEvents } from "@/lib/repo/orders";
import { listClients } from "@/lib/repo/clients";
import { PageHeader, Card, StatusBadge, Field, fmtDate, Empty, Stat } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { createSubscriptionAction, subscriptionActionForm } from "@/app/actions";
import { todayIso, shiftDays } from "@/lib/finance";

export default async function Subscriptions({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const user = await requirePermission("orders:view");
  const { open } = await searchParams;
  const rows = listSubscriptions();
  const active = rows.filter((r) => r.status === "active");
  const mrr = active.reduce((s, r) => s + r.price_per_cycle * (r.frequency === "weekly" ? 4.33 : r.frequency === "biweekly" ? 2.17 : 1), 0);
  const edit = can(user, "orders:edit");
  return (
    <div>
      <PageHeader kicker="Recurring revenue" title="Subscriptions">Weekly, biweekly or monthly packages with skips, pauses, cancellations and renewal reminders (5 days before).</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><Stat label="Active" value={active.length} sub={`${rows.filter((r) => r.status === "paused").length} paused`} /><Stat label="Monthly recurring revenue" value={formatZar(mrr)} sub="normalised" /><Stat label="Renewing ≤ 7 days" value={active.filter((r) => r.renewal_date <= shiftDays(todayIso(), 7)).length} tone="warn" /><Stat label="Meals / week committed" value={active.reduce((s, r) => s + r.meals_per_week, 0)} /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? <Empty>No subscriptions yet.</Empty> : <table className="table"><thead><tr><th>Client</th><th>Package</th><th>Meals/wk</th><th>Cycle</th><th>Price/cycle</th><th>Renews</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((s) => <tr key={s.id} className={open === String(s.id) ? "bg-bone-2/60" : ""}><td className="font-medium">{s.client_name}</td><td className="text-xs">{s.package_name ?? "Custom"}</td><td>{s.meals_per_week}</td><td className="text-xs">{s.frequency}</td><td>{formatZar(s.price_per_cycle)}</td><td className={s.status === "active" && s.renewal_date <= shiftDays(todayIso(), 5) ? "text-serious font-medium" : ""}>{fmtDate(s.renewal_date)}</td><td><StatusBadge status={s.status} /></td><td><div className="flex gap-1 flex-wrap">{edit && (["renew", "skip", s.status === "paused" ? "resume" : "pause", "cancel"] as const).map((a) => <form key={a} action={subscriptionActionForm}><input type="hidden" name="subscription_id" value={s.id} /><input type="hidden" name="action" value={a} /><button className="btn-ghost btn-sm" disabled={s.status === "cancelled"}>{a}</button></form>)}<a href={`/subscriptions?open=${s.id}`} className="btn-ghost btn-sm">history</a></div></td></tr>)}</tbody></table>}
          {open && <div className="mt-4 border-t border-line pt-3"><div className="kicker mb-1">History · subscription #{open}</div><ul className="text-xs text-ink-2 space-y-0.5">{subscriptionEvents(Number(open)).map((e) => <li key={e.id}>{fmtDate(e.created_at)} · {e.event_type}{e.week_start ? ` (week ${e.week_start})` : ""} {e.notes}</li>)}</ul></div>}
        </Card>
        {edit && <Card title="New subscription"><form action={createSubscriptionAction} className="grid grid-cols-2 gap-2"><Field label="Client" className="col-span-2"><select name="client_id" className="input" required>{listClients().map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></Field><Field label="Package" className="col-span-2"><select name="package_id" className="input"><option value="">Custom</option>{listPackages().map((p) => <option key={p.id} value={p.id}>{p.name} · {p.meals_per_week}/wk · {formatZar(p.price_zar)}</option>)}</select></Field><Field label="Meals / week (custom)"><input name="meals_per_week" type="number" className="input" /></Field><Field label="Frequency"><select name="frequency" className="input">{["weekly", "biweekly", "monthly"].map((f) => <option key={f}>{f}</option>)}</select></Field><Field label="Price / cycle (blank = package)"><input name="price_per_cycle" type="number" className="input" /></Field><Field label="Start date"><input name="start_date" type="date" defaultValue={todayIso()} className="input" /></Field><div><button className="btn-primary btn-sm">Create</button></div></form></Card>}
      </div>
    </div>
  );
}
