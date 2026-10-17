import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, Stat, StatusBadge, PageHeader, CategoryDot, Empty, fmtDate } from "@/components/ui";
import { BarChart, LineChart } from "@/components/charts";
import { summary, todayIso, startOfWeek, startOfMonth, dailyRevenue } from "@/lib/finance";
import { formatZar0 } from "@/lib/costing";
import { productionSummary, upcomingDeliveries, deliveriesForDate } from "@/lib/repo/production";
import { inventoryAlerts } from "@/lib/repo/inventory";
import { atRiskClients } from "@/lib/repo/clients";
import { mealPopularity } from "@/lib/repo/meals";
import { listSubscriptions, pendingPayments, listOrders } from "@/lib/repo/orders";
import { formatQty } from "@/lib/grocery";
import { shiftDays } from "@/lib/finance";

export default async function Dashboard() {
  const user = await requirePermission("dashboard:view");
  const db = getDb();
  const today = todayIso();
  const todayFin = summary({ from: today, to: today });
  const week = summary({ from: startOfWeek(), to: today });
  const month = summary({ from: startOfMonth(), to: today });
  const prod = productionSummary(today);
  const tomorrowProd = productionSummary(shiftDays(today, 1));
  const todayDeliveries = deliveriesForDate(today);
  const upcoming = upcomingDeliveries(7);
  const alerts = inventoryAlerts();
  const atRisk = atRiskClients();
  const popular = mealPopularity(30).slice(0, 6);
  const pending = pendingPayments();
  const todaysOrders = listOrders({ from: today, to: today });
  const newClients = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE registered_at >= date('now','-7 days')").get() as { n: number }).n;
  const active = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").get() as { n: number }).n;
  const reviewFlags = (db.prepare("SELECT COUNT(*) AS n FROM client_nutrition_targets t JOIN clients c ON c.id = t.client_id WHERE t.requires_professional_review = 1 AND c.anonymised_at IS NULL AND NOT EXISTS (SELECT 1 FROM professional_reviews r WHERE r.client_id = c.id AND r.outcome LIKE 'approved%')").get() as { n: number }).n;
  const satisfaction = db.prepare("SELECT AVG(overall) AS a, COUNT(*) AS n FROM feedback WHERE created_at >= date('now','-30 days')").get() as { a: number | null; n: number };
  const renewals = listSubscriptions().filter((s) => s.status === "active" && s.renewal_date <= shiftDays(today, 7));
  const daily = dailyRevenue(14);
  const costSplit = { food: month.cogs.food, packaging: month.cogs.packaging, labour: month.cogs.labour + (month.expenses.labour ?? 0), delivery: month.expenses.delivery ?? 0, marketing: month.expenses.marketing ?? 0 };
  const estProfit = month.net_profit;
  const isOps = ["kitchen", "packaging", "delivery"].includes(user.role);

  return (
    <div>
      <PageHeader kicker={fmtDate(today)} title={isOps ? "Operations today" : `Good day, ${user.name.split(" ")[0]}`}>
        {isOps ? "Orders, production, packaging and deliveries for today." : "Revenue, clients, production and alerts at a glance."}
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Today's orders" value={todaysOrders.length} sub={`${todaysOrders.reduce((s, o) => s + o.meals, 0)} meals`} href="/orders" />
        <Stat label="Meals to prepare" value={prod.remaining} sub={`${prod.required} required today · ${tomorrowProd.required} tomorrow`} href="/production" />
        <Stat label="Being prepared" value={prod.in_progress} sub={`${prod.batches.filter((b) => !["not_started", "ready", "delivered"].includes(b.status)).length} batches active`} href="/production" />
        <Stat label="Meals ready" value={prod.ready} sub="ready or delivered" tone="good" href="/production" />
        <Stat label="Deliveries today" value={todayDeliveries.length} sub={`${todayDeliveries.filter((d) => d.status === "delivered").length} delivered · ${todayDeliveries.filter((d) => d.status === "failed").length} failed`} href="/deliveries" />
        <Stat label="Pending payments" value={pending.length} sub={formatZar0(pending.reduce((s, o) => s + o.total_zar, 0)) + " outstanding"} tone={pending.length ? "warn" : "good"} href="/payments" />
        {!isOps && <>
          <Stat label="New clients (7d)" value={newClients} sub={reviewFlags ? `${reviewFlags} need professional review` : "no review flags"} tone={reviewFlags ? "warn" : "neutral"} href="/clients" />
          <Stat label="Active clients" value={active} sub={`${atRisk.length} at risk`} tone={atRisk.length ? "warn" : "good"} href="/clients?status=active" />
          <Stat label="Revenue today" value={formatZar0(todayFin.revenue)} sub={`week ${formatZar0(week.revenue)}`} href="/finance" />
          <Stat label="Revenue this month" value={formatZar0(month.revenue)} sub={`${month.orders} orders · AOV ${formatZar0(month.aov)}`} href="/finance" />
          <Stat label="Food & packaging" value={formatZar0(month.cogs.food + month.cogs.packaging)} sub={`${month.food_cost_pct.toFixed(0)}% food cost`} href="/finance" />
          <Stat label="Estimated profit" value={formatZar0(estProfit)} sub={`${month.net_margin_pct.toFixed(0)}% net margin (MTD)`} tone={estProfit >= 0 ? "good" : "critical"} href="/finance" />
        </>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {!isOps && (
          <Card title="Revenue, last 14 days" kicker="Cash received" className="lg:col-span-2">
            <LineChart labels={daily.map((d) => d.date.slice(5))} series={[{ name: "Revenue", values: daily.map((d) => d.revenue) }]} unit="R" height={180} />
          </Card>
        )}
        <Card title="Alerts" kicker="Needs attention" className={isOps ? "lg:col-span-1" : ""}>
          <ul className="text-sm space-y-2">
            {reviewFlags > 0 && !isOps && <li className="flex gap-2"><span className="badge bg-amber-100 text-amber-900">review</span><Link href="/clients" className="hover:underline">{reviewFlags} client(s) flagged for professional review</Link></li>}
            {alerts.low.slice(0, 5).map((l) => <li key={l.id} className="flex gap-2"><span className="badge bg-rose-100 text-rose-900">low stock</span><Link href="/inventory" className="hover:underline">{l.name}: {formatQty(l.stock, l.base_unit)} (min {formatQty(l.min_stock, l.base_unit)})</Link></li>)}
            {alerts.expiring.slice(0, 4).map((l) => <li key={l.id} className="flex gap-2"><span className="badge bg-amber-100 text-amber-900">expiring</span><Link href="/inventory" className="hover:underline">{l.ingredient} lot {l.batch_number} · {fmtDate(l.expiry_date)}</Link></li>)}
            {pending.slice(0, 3).map((o) => <li key={o.id} className="flex gap-2"><span className="badge bg-amber-100 text-amber-900">unpaid</span><Link href={`/orders/${o.id}`} className="hover:underline">{o.order_number} · {o.client_name} · {formatZar0(o.total_zar)}</Link></li>)}
            {renewals.slice(0, 3).map((r) => <li key={r.id} className="flex gap-2"><span className="badge bg-sky-100 text-sky-900">renewal</span><Link href="/subscriptions" className="hover:underline">{r.client_name} renews {fmtDate(r.renewal_date)}</Link></li>)}
            {atRisk.slice(0, 3).map((c) => <li key={c.id} className="flex gap-2"><span className="badge bg-rose-100 text-rose-900">at risk</span><Link href={`/clients/${c.id}`} className="hover:underline">{c.first_name} {c.last_name} · last order {fmtDate(c.last_order)}</Link></li>)}
            {!reviewFlags && !alerts.low.length && !alerts.expiring.length && !pending.length && !renewals.length && !atRisk.length && <li className="text-ink-3">All clear.</li>}
          </ul>
        </Card>

        <Card title="Today's production" kicker={`${prod.required} meals`} action={<Link href="/production" className="btn-secondary btn-sm">Open board</Link>} className="lg:col-span-2">
          {prod.batches.length === 0 ? <Empty>No production scheduled today. {tomorrowProd.required > 0 && <Link href={`/production?date=${shiftDays(today, 1)}`} className="text-accent">Tomorrow: {tomorrowProd.required} meals →</Link>}</Empty> : (
            <table className="table">
              <thead><tr><th>Meal</th><th>Qty</th><th>Status</th><th>Assigned</th><th>Clients</th></tr></thead>
              <tbody>{prod.batches.map((b) => <tr key={b.id}><td><CategoryDot category={b.category} /> {b.meal_name}</td><td>{b.quantity_required}</td><td><StatusBadge status={b.status} /></td><td className="text-ink-2">{b.assigned_name ?? "—"}</td><td className="text-ink-2 text-xs">{b.clients}</td></tr>)}</tbody>
            </table>
          )}
        </Card>

        <Card title="Upcoming deliveries" kicker="Next 7 days" action={<Link href="/deliveries" className="btn-secondary btn-sm">Routes</Link>}>
          {upcoming.length === 0 ? <Empty>No deliveries scheduled.</Empty> : <ul className="text-sm divide-y divide-line">{upcoming.slice(0, 8).map((d) => <li key={d.id} className="py-2 flex justify-between gap-2"><div><div>{d.client_name}</div><div className="text-xs text-ink-3">{fmtDate(d.delivery_date)} · {d.window_start}–{d.window_end} · {d.meals} meals</div></div><StatusBadge status={d.status} /></li>)}</ul>}
        </Card>

        {!isOps && <>
          <Card title="Most popular meals" kicker="Last 30 days">
            {popular.length ? <BarChart labels={popular.map((p) => p.name.split(" ").slice(0, 2).join(" "))} series={[{ name: "Servings", values: popular.map((p) => p.ordered) }]} height={170} /> : <Empty>No orders yet.</Empty>}
          </Card>
          <Card title="Cost structure" kicker="Month to date">
            <BarChart labels={["Food", "Packaging", "Labour", "Delivery", "Marketing"]} series={[{ name: "ZAR", values: [costSplit.food, costSplit.packaging, costSplit.labour, costSplit.delivery, costSplit.marketing] }]} unit="R" height={170} />
          </Card>
          <Card title="Client satisfaction" kicker="Last 30 days">
            <div className="stat-value">{satisfaction.a ? satisfaction.a.toFixed(2) : "—"} <span className="text-sm text-ink-3 font-sans">/ 5</span></div>
            <div className="text-xs text-ink-2 mt-1">{satisfaction.n} ratings · <Link href="/feedback" className="text-accent">see what to promote or remove</Link></div>
            <div className="mt-4 text-xs text-ink-2">Subscription renewals this week: <b className="text-ink">{renewals.length}</b> · Active subscriptions: <b className="text-ink">{listSubscriptions().filter((s) => s.status === "active").length}</b></div>
          </Card>
        </>}
      </div>
    </div>
  );
}
