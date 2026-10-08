import { getSessionUser, can } from "@/lib/auth";
import { exportClientData } from "@/lib/repo/clients";
import { listOrders, listPayments, listExpenses, getPlanFull, groceryForOrders } from "@/lib/repo/orders";
import { stockOverview } from "@/lib/repo/inventory";
import { batchesForDate, deliveriesForDate } from "@/lib/repo/production";
import { mealProfitability, monthlySeries } from "@/lib/finance";
import { DAY_NAMES } from "@/lib/types";

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
const file = (name: string, body: string, type = "text/csv") => new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "content-disposition": `attachment; filename="${name}"` } });

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "client") return new Response("Unauthorized", { status: 401 });
  const { path } = await params;
  const url = new URL(req.url);
  const [kind, id] = path;
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  switch (kind) {
    case "client": if (!can(user, "clients:view")) break; return file(`client-${id}.json`, JSON.stringify(exportClientData(Number(id)), null, 2), "application/json");
    case "orders": if (!can(user, "orders:view")) break; return file("orders.csv", csv(listOrders().map((o) => ({ order: o.order_number, client: o.client_name, delivery: o.delivery_date, meals: o.meals, total: o.total_zar, payment: o.payment_status, status: o.status }))));
    case "payments": if (!can(user, "finance:view")) break; return file("payments.csv", csv(listPayments().map((p) => ({ date: p.paid_at, client: p.client_name, order: p.order_number, amount: p.amount_zar, method: p.method, reference: p.reference, status: p.status }))));
    case "expenses": if (!can(user, "finance:view")) break; return file("expenses.csv", csv(listExpenses().map((e) => ({ date: e.incurred_at, category: e.category, description: e.description, amount: e.amount_zar, recurring: e.is_recurring }))));
    case "inventory": if (!can(user, "inventory:view")) break; return file("inventory.csv", csv(stockOverview().map((s) => ({ ingredient: s.name, category: s.category, stock: s.stock, unit: s.base_unit, min_stock: s.min_stock, lots: s.lots, next_expiry: s.next_expiry, value: Math.round(s.value * 100) / 100 }))));
    case "grocery": { if (!can(user, "inventory:view")) break; const from = url.searchParams.get("from") ?? date, to = url.searchParams.get("to") ?? date; return file(`grocery-${from}-${to}.csv`, csv(groceryForOrders({ from, to }).lines.map((l) => ({ category: l.category, ingredient: l.name, required: l.required, with_waste: l.with_waste, stock: l.stock, to_purchase: l.to_purchase, unit: l.unit, est_cost: l.est_cost, supplier: l.supplier, meals: l.meals.join("; ") })))); }
    case "production": if (!can(user, "production:view")) break; return file(`production-${date}.csv`, csv(batchesForDate(date).map((b) => ({ meal: b.meal_name, category: b.category, required: b.quantity_required, done: b.quantity_done, wasted: b.quantity_wasted, status: b.status, assigned: b.assigned_name, clients: b.clients }))));
    case "deliveries": if (!can(user, "deliveries:view")) break; return file(`deliveries-${date}.csv`, csv(deliveriesForDate(date).map((d) => ({ sequence: d.sequence, client: d.client_name, phone: d.phone, address: d.address, window: `${d.window_start}-${d.window_end}`, meals: d.meals, driver: d.driver_name, status: d.status, notes: d.delivery_notes }))));
    case "plan": { if (!can(user, "plans:view")) break; const p = getPlanFull(Number(id)); if (!p) break; return file(`meal-plan-${id}.csv`, csv(p.items.map((i) => ({ day: DAY_NAMES[i.day_index], slot: i.slot, meal: i.meal.name, kcal: i.meal.nutrition.kcal, protein: i.meal.nutrition.protein, carbs: i.meal.nutrition.carbs, fat: i.meal.nutrition.fat, fibre: i.meal.nutrition.fibre, portion: i.portion_multiplier })))); }
    case "profitability": if (!can(user, "finance:view")) break; return file("profitability.csv", csv(mealProfitability(90).map((m) => ({ meal: m.name, category: m.category, sold: m.sold, revenue: m.revenue, cost: m.cost, profit: m.profit }))));
    case "monthly": if (!can(user, "finance:view")) break; return file("monthly-report.csv", csv(monthlySeries(12)));
  }
  return new Response("Not found or forbidden", { status: 404 });
}
