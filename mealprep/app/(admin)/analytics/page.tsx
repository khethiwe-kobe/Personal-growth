import { requirePermission } from "@/lib/auth";
import { fullAnalytics, demandForecast } from "@/lib/analytics";
import { listClients } from "@/lib/repo/clients";
import { listMeals } from "@/lib/repo/meals";
import { listPackages, listSubscriptions } from "@/lib/repo/orders";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Stat, Field } from "@/components/ui";
import { BarChart, LineChart } from "@/components/charts";
import { formatZar0 } from "@/lib/costing";
import { todayIso, shiftDays } from "@/lib/finance";

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("analytics:view");
  const sp = await searchParams;
  const f = { from: sp.from ?? shiftDays(todayIso(), -90), to: sp.to ?? todayIso(), client_id: sp.client ? Number(sp.client) : null, meal_id: sp.meal ? Number(sp.meal) : null, package_id: sp.package ? Number(sp.package) : null, subscription_id: sp.subscription ? Number(sp.subscription) : null, staff_id: sp.staff ? Number(sp.staff) : null };
  const a = fullAnalytics(f);
  const fc = demandForecast(1);
  const staff = getDb().prepare("SELECT id, name FROM users WHERE role IN ('kitchen','packaging','admin') AND is_active = 1").all() as { id: number; name: string }[];
  const filtered = f.client_id || f.meal_id || f.package_id || f.subscription_id || f.staff_id;
  return (
    <div>
      <PageHeader kicker="Intelligence" title="Business analytics">Growth, retention, profitability, waste and satisfaction. Filter the order metrics by date, client, meal, package, subscription or staff member.</PageHeader>
      <Card className="mb-4"><form className="grid sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
        <Field label="From"><input name="from" type="date" defaultValue={f.from} className="input" /></Field><Field label="To"><input name="to" type="date" defaultValue={f.to} className="input" /></Field>
        <Field label="Client"><select name="client" defaultValue={sp.client ?? ""} className="input"><option value="">All</option>{listClients().map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></Field>
        <Field label="Meal"><select name="meal" defaultValue={sp.meal ?? ""} className="input"><option value="">All</option>{listMeals().map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Package"><select name="package" defaultValue={sp.package ?? ""} className="input"><option value="">All</option>{listPackages(false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Subscription"><select name="subscription" defaultValue={sp.subscription ?? ""} className="input"><option value="">All</option>{listSubscriptions().map((s) => <option key={s.id} value={s.id}>#{s.id} {s.client_name}</option>)}</select></Field>
        <Field label="Staff"><select name="staff" defaultValue={sp.staff ?? ""} className="input"><option value="">All</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="lg:col-span-7"><button className="btn-secondary btn-sm">Apply filters</button></div>
      </form></Card>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
        <Stat label={filtered ? "Filtered orders" : "Orders in period"} value={a.filtered.orders} sub={`${a.filtered.meals} meals`} />
        <Stat label="Revenue (orders)" value={formatZar0(a.filtered.revenue)} sub={`AOV ${formatZar0(a.filtered.aov)}`} />
        <Stat label="Gross profit" value={formatZar0(a.filtered.profit)} sub={`${a.filtered.margin_pct.toFixed(0)}% margin`} tone="good" />
        <Stat label="Retention" value={`${a.retention.retained_pct.toFixed(0)}%`} sub={`${a.retention.active} active · ${a.retention.churned} churned`} />
        <Stat label="Food cost %" value={`${a.finance.food_cost_pct.toFixed(0)}%`} sub="of cash revenue" />
        <Stat label="Waste" value={`${a.waste_pct.toFixed(1)}%`} sub={`${a.waste.meals_wasted} meals · ${formatZar0(a.waste.total_value)} ingredients`} tone={a.waste_pct > 5 ? "warn" : "good"} />
        <Stat label="Meals produced" value={a.produced.produced} sub={`${a.produced.batches} batches in period`} />
        <Stat label="Satisfaction" value={a.satisfaction.filter((s) => s.rating).slice(-1)[0]?.rating?.toFixed(2) ?? "—"} sub="latest week avg" />
        <Stat label="Subscription growth" value={a.growth[a.growth.length - 1]?.subscriptions ?? 0} sub={`from ${a.growth[0]?.subscriptions ?? 0} six months ago`} />
        <Stat label="Repeat rate" value={`${a.customers.repeat_rate.toFixed(0)}%`} />
        <Stat label="CAC" value={formatZar0(a.customers.cac)} /><Stat label="CLV" value={formatZar0(a.customers.clv)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Revenue growth" kicker="Monthly cash received"><LineChart labels={a.monthly.map((m) => m.month)} series={[{ name: "Revenue", values: a.monthly.map((m) => m.revenue) }, { name: "Net profit", values: a.monthly.map((m) => m.profit) }]} unit="R" height={200} /></Card>
        <Card title="Customer growth" kicker="Clients registered per month & active subscriptions"><BarChart labels={a.growth.map((g) => g.month)} series={[{ name: "New clients", values: a.growth.map((g) => g.added) }, { name: "Subscriptions", values: a.growth.map((g) => g.subscriptions) }]} height={200} /></Card>
        <Card title="Orders & meals per week"><BarChart labels={a.orders_per_week.map((w) => w.week)} series={[{ name: "Orders", values: a.orders_per_week.map((w) => w.orders) }, { name: "Meals", values: a.orders_per_week.map((w) => w.meals) }]} height={200} /></Card>
        <Card title="Customer satisfaction" kicker="Weekly average rating (1–5)"><LineChart labels={a.satisfaction.map((w) => w.week)} series={[{ name: "Rating", values: a.satisfaction.map((w) => w.rating ?? NaN) }]} yMin={1} height={200} /></Card>
        <Card title="Most popular meals" kicker="Servings, 90 days"><BarChart labels={a.popular.slice(0, 8).map((p) => p.name.split(" ").slice(0, 2).join(" "))} series={[{ name: "Servings", values: a.popular.slice(0, 8).map((p) => p.ordered) }]} height={200} /></Card>
        <Card title="Most profitable meals" kicker="Gross profit, 90 days"><BarChart labels={a.profitable.slice(0, 8).map((p) => p.name.split(" ").slice(0, 2).join(" "))} series={[{ name: "Profit", values: a.profitable.slice(0, 8).map((p) => p.profit) }]} unit="R" height={200} /></Card>
        <Card title="Retention cohorts" kicker="Share of each month's sign-ups that ordered again"><table className="table"><thead><tr><th>Cohort</th><th>Clients</th><th>Ordered again</th></tr></thead><tbody>{a.retention.cohorts.map((c) => <tr key={c.month}><td>{c.month}</td><td>{c.clients}</td><td>{c.ordered_again_pct.toFixed(0)}%</td></tr>)}</tbody></table></Card>
        <Card title="Demand forecast (next week)" kicker="4-week moving average · floor from active subscriptions"><div className="text-sm mb-2">~<b>{fc.total_forecast}</b> meals forecast · subscriptions guarantee <b>{fc.subscription_floor}</b></div><table className="table"><thead><tr><th>Meal</th><th>Last 4 wks</th><th>Forecast</th></tr></thead><tbody>{fc.per_meal.slice(0, 8).map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.q}</td><td className="font-medium">{m.forecast}</td></tr>)}</tbody></table></Card>
      </div>
    </div>
  );
}
