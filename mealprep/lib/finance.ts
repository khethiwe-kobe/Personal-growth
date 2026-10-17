import { getDb, getSettingNumber } from "./db";
export { breakEven } from "./costing";

/** Finance & profitability. All money in ZAR. */

export type Range = { from: string; to: string };

export function todayIso(): string { return new Date().toISOString().slice(0, 10); }
export function startOfWeek(d = new Date()): string { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10); }
export function startOfMonth(d = new Date()): string { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
export function shiftDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function shiftMonths(iso: string, n: number): string { const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }

export function revenue(r: Range): number {
  const row = getDb().prepare("SELECT COALESCE(SUM(amount_zar),0) AS s FROM payments WHERE status = 'completed' AND date(paid_at) BETWEEN ? AND ?").get(r.from, r.to) as { s: number };
  return row.s;
}

export function expensesByCategory(r: Range): Record<string, number> {
  const rows = getDb().prepare("SELECT category, SUM(amount_zar) AS s FROM expenses WHERE incurred_at BETWEEN ? AND ? GROUP BY category").all(r.from, r.to) as { category: string; s: number }[];
  const out: Record<string, number> = {};
  for (const row of rows) out[row.category] = row.s;
  return out;
}

/** COGS from order item cost snapshots for orders delivered in range. */
export function cogs(r: Range): { food: number; packaging: number; labour: number; overhead: number; total: number; meals: number } {
  const db = getDb();
  const row = db.prepare(
    `SELECT COALESCE(SUM(oi.unit_cost_zar * oi.quantity),0) AS total, COALESCE(SUM(oi.quantity),0) AS meals
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('delivered','completed') AND o.delivery_date BETWEEN ? AND ?`
  ).get(r.from, r.to) as { total: number; meals: number };
  const packaging = getSettingNumber("default_packaging_cost") * row.meals;
  const overhead = getSettingNumber("overhead_per_meal") * row.meals;
  const labour = (4 / 60) * getSettingNumber("labour_rate_per_hour") * row.meals;
  const food = Math.max(0, row.total - packaging - overhead - labour);
  return { food, packaging, labour, overhead, total: row.total, meals: row.meals };
}

export type FinanceSummary = {
  range: Range; revenue: number; cogs: ReturnType<typeof cogs>; expenses: Record<string, number>; total_expenses: number;
  gross_profit: number; gross_margin_pct: number; net_profit: number; net_margin_pct: number; food_cost_pct: number;
  orders: number; aov: number; meals_sold: number;
};

export function summary(r: Range): FinanceSummary {
  const db = getDb();
  const rev = revenue(r);
  const c = cogs(r);
  const ex = expensesByCategory(r);
  // Food purchases are expenses already; avoid double counting food vs COGS by using operating expenses excluding 'food' & 'packaging'.
  const opex = Object.entries(ex).filter(([k]) => !["food", "packaging"].includes(k)).reduce((s, [, v]) => s + v, 0);
  const ordersRow = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total_zar),0) AS t FROM orders WHERE status NOT IN ('cancelled','inquiry','quote_sent') AND created_at BETWEEN ? AND ?").get(r.from, r.to + "T23:59:59") as { n: number; t: number };
  const gross = rev - c.total;
  const net = gross - opex;
  return {
    range: r, revenue: rev, cogs: c, expenses: ex, total_expenses: opex + c.total,
    gross_profit: gross, gross_margin_pct: rev > 0 ? (gross / rev) * 100 : 0,
    net_profit: net, net_margin_pct: rev > 0 ? (net / rev) * 100 : 0,
    food_cost_pct: rev > 0 ? (c.food / rev) * 100 : 0,
    orders: ordersRow.n, aov: ordersRow.n ? ordersRow.t / ordersRow.n : 0, meals_sold: c.meals,
  };
}

export function monthlySeries(months = 6): { month: string; revenue: number; expenses: number; cogs: number; profit: number; orders: number }[] {
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const r = { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    const s = summary(r);
    out.push({ month: monthLabel(start), revenue: s.revenue, expenses: s.total_expenses, cogs: s.cogs.total, profit: s.net_profit, orders: s.orders });
  }
  return out;
}

export function dailyRevenue(days = 30): { date: string; revenue: number }[] {
  const rows = getDb().prepare("SELECT date(paid_at) AS d, SUM(amount_zar) AS s FROM payments WHERE status = 'completed' AND date(paid_at) >= date('now', ?) GROUP BY d").all(`-${days} days`) as { d: string; s: number }[];
  const map = new Map(rows.map((r) => [r.d, r.s]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const d = shiftDays(todayIso(), -i); out.push({ date: d, revenue: map.get(d) ?? 0 }); }
  return out;
}

export function customerMetrics(): { cac: number; clv: number; repeat_rate: number; active_clients: number; avg_orders_per_client: number; avg_order_value: number } {
  const db = getDb();
  const marketing = (db.prepare("SELECT COALESCE(SUM(amount_zar),0) AS s FROM expenses WHERE category = 'marketing' AND incurred_at >= date('now','-90 days')").get() as { s: number }).s
    + (db.prepare("SELECT COALESCE(SUM(spend_zar),0) AS s FROM marketing_campaigns WHERE start_date >= date('now','-90 days')").get() as { s: number }).s;
  const newClients = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE registered_at >= date('now','-90 days')").get() as { n: number }).n;
  const cac = newClients ? marketing / newClients : 0;
  const perClient = db.prepare("SELECT client_id, COUNT(*) AS n, SUM(total_zar) AS t FROM orders WHERE status NOT IN ('cancelled','inquiry','quote_sent') GROUP BY client_id").all() as { client_id: number; n: number; t: number }[];
  const clientsWithOrders = perClient.length;
  const repeat = perClient.filter((p) => p.n > 1).length;
  const avgOrders = clientsWithOrders ? perClient.reduce((s, p) => s + p.n, 0) / clientsWithOrders : 0;
  const aov = perClient.reduce((s, p) => s + p.n, 0) ? perClient.reduce((s, p) => s + p.t, 0) / perClient.reduce((s, p) => s + p.n, 0) : 0;
  const marginPct = getSettingNumber("target_margin_standard");
  // CLV ≈ AOV × orders per client per year (annualised from observed cadence) × gross margin × expected 1.5-year lifetime.
  const clv = aov * Math.max(avgOrders, 1) * marginPct * 1.5;
  const active = (db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").get() as { n: number }).n;
  return { cac, clv, repeat_rate: clientsWithOrders ? (repeat / clientsWithOrders) * 100 : 0, active_clients: active, avg_orders_per_client: avgOrders, avg_order_value: aov };
}

export function mealProfitability(days = 90) {
  return getDb().prepare(
    `SELECT m.id, m.name, m.category, SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.unit_price_zar) AS revenue,
            SUM(oi.quantity * oi.unit_cost_zar) AS cost, SUM(oi.quantity * (oi.unit_price_zar - oi.unit_cost_zar)) AS profit
       FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN meals m ON m.id = oi.meal_id
      WHERE o.status NOT IN ('cancelled','inquiry','quote_sent') AND o.created_at >= date('now', ?) GROUP BY m.id ORDER BY profit DESC`
  ).all(`-${days} days`) as { id: number; name: string; category: string; sold: number; revenue: number; cost: number; profit: number }[];
}

export function monthLabel(d: Date): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + String(d.getFullYear()).slice(2);
}
