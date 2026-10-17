import { getDb } from "./db";
import { summary, monthlySeries, customerMetrics, mealProfitability, shiftDays, todayIso } from "./finance";
import { wasteSummary } from "./repo/inventory";
import { mealPopularity } from "./repo/meals";

export type AnalyticsFilter = { from: string; to: string; client_id?: number | null; meal_id?: number | null; package_id?: number | null; subscription_id?: number | null; staff_id?: number | null };

export function clientGrowth(months = 6) {
  const db = getDb();
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const from = start.toISOString().slice(0, 10), to = end.toISOString().slice(0, 10);
    const added = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE date(registered_at) BETWEEN ? AND ?").get(from, to) as { n: number }).n;
    const total = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE date(registered_at) <= ?").get(to) as { n: number }).n;
    const activeSubs = (db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE start_date <= ? AND (cancelled_at IS NULL OR date(cancelled_at) > ?)").get(to, to) as { n: number }).n;
    out.push({ month: monthLabel(start), added, total, subscriptions: activeSubs });
  }
  return out;
}

export function retention(): { retained_pct: number; churned: number; active: number; cohorts: { month: string; clients: number; ordered_again_pct: number }[] } {
  const db = getDb();
  const active = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").get() as { n: number }).n;
  const churned = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'churned'").get() as { n: number }).n;
  const cohorts = (db.prepare("SELECT strftime('%Y-%m', registered_at) AS month, COUNT(*) AS clients, SUM(CASE WHEN (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id AND o.status NOT IN ('cancelled')) > 1 THEN 1 ELSE 0 END) AS repeaters FROM clients c GROUP BY month ORDER BY month DESC LIMIT 6").all() as { month: string; clients: number; repeaters: number }[])
    .map((c) => ({ month: c.month, clients: c.clients, ordered_again_pct: c.clients ? (c.repeaters / c.clients) * 100 : 0 }));
  return { retained_pct: active + churned ? (active / (active + churned)) * 100 : 100, churned, active, cohorts };
}

export function ordersPerWeek(weeks = 8) {
  const db = getDb();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = shiftDays(todayIso(), -7 * i);
    const start = shiftDays(end, -6);
    const r = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM((SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id)),0) AS meals FROM orders o WHERE o.status NOT IN ('cancelled','inquiry','quote_sent') AND o.delivery_date BETWEEN ? AND ?").get(start, end) as { n: number; meals: number };
    out.push({ week: start.slice(5), orders: r.n, meals: r.meals });
  }
  return out;
}

export function satisfactionTrend(weeks = 8) {
  const db = getDb();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = shiftDays(todayIso(), -7 * i);
    const start = shiftDays(end, -6);
    const r = db.prepare("SELECT AVG(overall) AS a, COUNT(*) AS n FROM feedback WHERE date(created_at) BETWEEN ? AND ?").get(start, end) as { a: number | null; n: number };
    out.push({ week: start.slice(5), rating: r.a, count: r.n });
  }
  return out;
}

export function mealsProduced(r: { from: string; to: string }) {
  return getDb().prepare("SELECT COALESCE(SUM(quantity_done),0) AS produced, COALESCE(SUM(quantity_wasted),0) AS wasted, COUNT(*) AS batches FROM production_batches WHERE production_date BETWEEN ? AND ?").get(r.from, r.to) as { produced: number; wasted: number; batches: number };
}

export function filteredOrders(f: AnalyticsFilter) {
  const where: string[] = ["o.status NOT IN ('cancelled','inquiry','quote_sent')", "o.delivery_date BETWEEN ? AND ?"];
  const params: unknown[] = [f.from, f.to];
  if (f.client_id) { where.push("o.client_id = ?"); params.push(f.client_id); }
  if (f.package_id) { where.push("o.package_id = ?"); params.push(f.package_id); }
  if (f.subscription_id) { where.push("o.subscription_id = ?"); params.push(f.subscription_id); }
  if (f.meal_id) { where.push("EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.meal_id = ?)"); params.push(f.meal_id); }
  if (f.staff_id) { where.push("EXISTS (SELECT 1 FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id JOIN production_batches b ON b.id = pi.batch_id WHERE oi.order_id = o.id AND b.assigned_user_id = ?)"); params.push(f.staff_id); }
  const row = getDb().prepare(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total_zar),0) AS revenue,
            COALESCE(SUM((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id)),0) AS meals,
            COALESCE(SUM((SELECT SUM(oi.quantity * oi.unit_cost_zar) FROM order_items oi WHERE oi.order_id = o.id)),0) AS cost
       FROM orders o WHERE ${where.join(" AND ")}`
  ).get(...params) as { orders: number; revenue: number; meals: number; cost: number };
  return { ...row, profit: row.revenue - row.cost, margin_pct: row.revenue ? ((row.revenue - row.cost) / row.revenue) * 100 : 0, aov: row.orders ? row.revenue / row.orders : 0 };
}

export function fullAnalytics(f: AnalyticsFilter) {
  const fin = summary({ from: f.from, to: f.to });
  const waste = wasteSummary(90);
  return {
    finance: fin,
    filtered: filteredOrders(f),
    monthly: monthlySeries(6),
    growth: clientGrowth(6),
    retention: retention(),
    orders_per_week: ordersPerWeek(8),
    satisfaction: satisfactionTrend(8),
    popular: mealPopularity(90).slice(0, 10),
    profitable: mealProfitability(90).slice(0, 10),
    produced: mealsProduced({ from: f.from, to: f.to }),
    waste,
    waste_pct: waste.meals_done + waste.meals_wasted ? (waste.meals_wasted / (waste.meals_done + waste.meals_wasted)) * 100 : 0,
    customers: customerMetrics(),
  };
}

/** Naive demand forecast: 4-week moving average of meals per week, per meal. */
export function demandForecast(weeksAhead = 1) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT m.id, m.name, SUM(oi.quantity) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN meals m ON m.id = oi.meal_id
      WHERE o.status NOT IN ('cancelled','inquiry','quote_sent') AND o.delivery_date >= date('now','-28 days') AND o.delivery_date < date('now') GROUP BY m.id ORDER BY q DESC`
  ).all() as { id: number; name: string; q: number }[];
  const subs = (db.prepare("SELECT COALESCE(SUM(meals_per_week),0) AS s FROM subscriptions WHERE status = 'active'").get() as { s: number }).s;
  return { per_meal: rows.map((r) => ({ ...r, forecast: Math.round((r.q / 4) * weeksAhead) })), total_forecast: Math.round(rows.reduce((s, r) => s + r.q, 0) / 4 * weeksAhead), subscription_floor: subs * weeksAhead };
}

function monthLabel(d: Date): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + String(d.getFullYear()).slice(2);
}
