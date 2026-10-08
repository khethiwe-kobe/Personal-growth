import { getDb } from "./db";
import { summary, startOfMonth, todayIso, mealProfitability, shiftDays, startOfWeek } from "./finance";
import { wasteSummary, compareSuppliers, inventoryAlerts } from "./repo/inventory";
import { mealPopularity } from "./repo/meals";
import { groceryForOrders, listSubscriptions, pendingPayments } from "./repo/orders";
import { formatQty } from "./grocery";
import { feedbackInsights } from "./repo/orders";
import { formatZar } from "./costing";
import { demandForecast } from "./analytics";

/**
 * Business assistant. Intent matching over live data — no external model is
 * required. Each intent returns a structured answer (text + optional table) so
 * an LLM layer can later be put in front of the same retrieval functions.
 */
export type Answer = { title: string; text: string; table?: { columns: string[]; rows: (string | number)[][] }; link?: string };

type Intent = { patterns: RegExp[]; example: string; run: (q: string) => Answer };

const month = () => ({ from: startOfMonth(), to: todayIso() });

const intents: Intent[] = [
  {
    patterns: [/profit/i, /most profitable/i],
    example: "Which meals made the most profit this month?",
    run: () => {
      const rows = mealProfitability(30).slice(0, 8);
      return { title: "Most profitable meals (last 30 days)", text: rows.length ? `${rows[0].name} leads with ${formatZar(rows[0].profit)} gross profit.` : "No orders yet in this period.", table: { columns: ["Meal", "Sold", "Revenue", "Cost", "Profit"], rows: rows.map((r) => [r.name, r.sold, formatZar(r.revenue), formatZar(r.cost), formatZar(r.profit)]) }, link: "/finance" };
    },
  },
  {
    patterns: [/waste/i, /wasting/i],
    example: "Which ingredients are causing the most waste?",
    run: () => {
      const w = wasteSummary(30);
      return { title: "Waste (last 30 days)", text: `Total ingredient waste value ${formatZar(w.total_value)}; ${w.meals_wasted} meals wasted in production.`, table: { columns: ["Ingredient", "Quantity", "Value", "Events"], rows: w.ingredients.slice(0, 8).map((r) => [r.name, formatQty(r.qty, r.base_unit), formatZar(r.value), r.events]) }, link: "/inventory" };
    },
  },
  {
    patterns: [/haven'?t ordered/i, /not ordered/i, /inactive/i, /at.?risk/i],
    example: "Which clients haven't ordered this month?",
    run: () => {
      const rows = getDb().prepare("SELECT c.id, c.first_name || ' ' || c.last_name AS name, c.status, (SELECT MAX(delivery_date) FROM orders o WHERE o.client_id = c.id) AS last FROM clients c WHERE c.anonymised_at IS NULL AND c.status IN ('active','paused') AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.client_id = c.id AND o.created_at >= ?) ORDER BY last").all(startOfMonth()) as { id: number; name: string; status: string; last: string | null }[];
      return { title: "Clients without an order this month", text: rows.length ? `${rows.length} active/paused clients have not ordered since the start of the month.` : "Every active client has ordered this month.", table: { columns: ["Client", "Status", "Last delivery"], rows: rows.map((r) => [r.name, r.status, r.last ?? "never"]) }, link: "/clients" };
    },
  },
  {
    patterns: [/what should i buy/i, /shopping/i, /purchase/i, /grocery/i, /how much (chicken|rice|beef|salmon|eggs?|broccoli|.+?) (do i|do we) need/i],
    example: "How much chicken do I need next week?",
    run: (q) => {
      const from = shiftDays(startOfWeek(), 7), to = shiftDays(from, 6);
      const g = groceryForOrders({ from, to, statuses: ["awaiting_payment", "paid", "plan_created", "shopping", "preparing"] });
      const m = q.match(/how much (.+?) (do i|do we) need/i);
      let lines = g.lines;
      if (m) lines = lines.filter((l) => l.name.toLowerCase().includes(m[1].toLowerCase()));
      const toBuy = lines.filter((l) => l.to_purchase > 0);
      const text = m
        ? lines.length ? lines.map((l) => `${l.name}: ${formatQty(l.with_waste, l.unit)} required (incl. waste), ${formatQty(l.stock, l.unit)} in stock → buy ${formatQty(l.to_purchase, l.unit)}.`).join(" ") : `No ${m[1]} is required for next week's orders.`
        : `Next week (${from} → ${to}) has ${g.orders} orders / ${g.meals} meals. ${toBuy.length} ingredients need purchasing.`;
      return { title: m ? `${m[1]} requirement for next week` : "Purchase list for next week", text, table: { columns: ["Ingredient", "Required", "In stock", "Buy", "Est. cost", "Supplier"], rows: (m ? lines : toBuy).slice(0, 15).map((l) => [l.name, formatQty(l.with_waste, l.unit), formatQty(l.stock, l.unit), formatQty(l.to_purchase, l.unit), l.est_cost == null ? "—" : formatZar(l.est_cost), l.supplier ?? "—"]) }, link: "/grocery" };
    },
  },
  {
    patterns: [/popular/i, /best.?sell/i, /promote/i],
    example: "Which meals should we promote?",
    run: (q) => {
      const pop = mealPopularity(90).slice(0, 8);
      const fi = feedbackInsights();
      if (/promote/i.test(q)) {
        const rows = fi.promote.length ? fi.promote : pop.slice(0, 5).map((p) => ({ id: p.id, name: p.name, n: p.ratings, overall: p.rating ?? 0 }));
        return { title: "Meals to promote", text: fi.promote.length ? "These meals rate 4.3+ with at least two reviews — strong candidates for campaigns and the portal's featured section." : "Not enough ratings yet; showing the most ordered meals instead.", table: { columns: ["Meal", "Reviews", "Rating"], rows: rows.map((r) => [r.name, r.n, Number(r.overall).toFixed(1)]) }, link: "/feedback" };
      }
      return { title: "Most popular meals (90 days)", text: pop.length ? `${pop[0].name} is the most ordered meal (${pop[0].ordered} servings).` : "No orders yet.", table: { columns: ["Meal", "Category", "Servings", "Rating"], rows: pop.map((p) => [p.name, p.category, p.ordered, p.rating ? p.rating.toFixed(1) : "—"]) }, link: "/analytics" };
    },
  },
  {
    patterns: [/high.?protein/i, /prefer/i],
    example: "Which clients prefer high-protein meals?",
    run: (q) => {
      const tag = /high.?protein/i.test(q) ? "high_protein" : /lower.?carb|low.?carb/i.test(q) ? "lower_carb" : /vegan/i.test(q) ? "vegan" : /vegetarian/i.test(q) ? "vegetarian" : "high_protein";
      const rows = getDb().prepare("SELECT c.id, c.first_name || ' ' || c.last_name AS name, p.dietary_tags, p.dietary_pattern, (SELECT goal_type FROM client_goals g WHERE g.client_id = c.id AND g.is_primary = 1) AS goal FROM clients c JOIN client_preferences p ON p.client_id = c.id WHERE c.anonymised_at IS NULL AND (p.dietary_tags LIKE ? OR p.dietary_pattern = ? OR EXISTS (SELECT 1 FROM client_goals g WHERE g.client_id = c.id AND g.goal_type = ?))").all(`%${tag}%`, tag, tag) as { id: number; name: string; dietary_pattern: string; goal: string | null }[];
      return { title: `Clients preferring ${tag.replace("_", " ")}`, text: `${rows.length} clients have this preference, pattern or goal.`, table: { columns: ["Client", "Pattern", "Primary goal"], rows: rows.map((r) => [r.name, r.dietary_pattern, r.goal ?? "—"]) }, link: "/clients" };
    },
  },
  {
    patterns: [/cheapest/i, /supplier/i],
    example: "Which supplier has the cheapest chicken?",
    run: (q) => {
      const m = q.match(/cheapest (.+?)(\?|$)/i) ?? q.match(/supplier for (.+?)(\?|$)/i);
      const needle = m ? m[1].trim() : "";
      const ing = getDb().prepare("SELECT id, name, base_unit FROM ingredients WHERE name LIKE ? ORDER BY name LIMIT 1").get(`%${needle}%`) as { id: number; name: string; base_unit: string } | undefined;
      if (!ing) return { title: "Supplier comparison", text: `I couldn't find an ingredient matching "${needle}". Try "cheapest chicken breast".`, link: "/suppliers" };
      const opts = compareSuppliers(ing.id);
      const rec = opts.find((o) => o.recommended);
      const cheapest = [...opts].sort((a, b) => a.price_per_unit - b.price_per_unit)[0];
      return { title: `Suppliers for ${ing.name}`, text: rec && cheapest ? `${cheapest.supplier} is cheapest at ${formatZar(cheapest.price_per_unit * 1000)}/kg; recommended overall (price + reliability + quality): ${rec.supplier}.` : "No supplier prices recorded.", table: { columns: ["Supplier", "Price / kg or L", "Reliability", "Quality", "Lead time", "Score"], rows: opts.map((o) => [o.supplier + (o.recommended ? " ★" : ""), formatZar(o.price_per_unit * 1000), o.reliability, o.quality, `${o.lead_time_days} d`, o.score]) }, link: "/suppliers" };
    },
  },
  {
    patterns: [/revenue/i, /how much did we make/i, /sales/i],
    example: "How much revenue did we make this month?",
    run: () => {
      const s = summary(month());
      return { title: "This month so far", text: `Revenue ${formatZar(s.revenue)} from ${s.orders} orders (AOV ${formatZar(s.aov)}). Gross profit ${formatZar(s.gross_profit)} (${s.gross_margin_pct.toFixed(0)} %), estimated net ${formatZar(s.net_profit)}.`, link: "/finance" };
    },
  },
  {
    patterns: [/subscription/i, /expir/i, /renew/i],
    example: "Which subscriptions are expiring?",
    run: () => {
      const rows = listSubscriptions().filter((s) => s.status === "active" && s.renewal_date <= shiftDays(todayIso(), 7));
      return { title: "Subscriptions renewing within 7 days", text: rows.length ? `${rows.length} subscriptions renew this week.` : "No renewals due in the next 7 days.", table: { columns: ["Client", "Package", "Renews", "Meals/week"], rows: rows.map((s) => [s.client_name, s.package_name ?? "custom", s.renewal_date, s.meals_per_week]) }, link: "/subscriptions" };
    },
  },
  {
    patterns: [/unpaid/i, /pending payment/i, /owe/i, /outstanding/i],
    example: "Which orders are unpaid?",
    run: () => {
      const rows = pendingPayments();
      return { title: "Orders awaiting payment", text: `${rows.length} orders totalling ${formatZar(rows.reduce((s, r) => s + r.total_zar, 0))} are not fully paid.`, table: { columns: ["Order", "Client", "Delivery", "Total", "Status"], rows: rows.map((r) => [r.order_number, r.client_name, r.delivery_date, formatZar(r.total_zar), r.status]) }, link: "/payments" };
    },
  },
  {
    patterns: [/low stock/i, /running low/i, /stock/i, /expiring/i],
    example: "What is low in stock?",
    run: () => {
      const a = inventoryAlerts();
      return { title: "Inventory alerts", text: `${a.low.length} ingredients below minimum stock; ${a.expiring.length} lots expiring within 3 days.`, table: { columns: ["Ingredient", "Stock", "Minimum"], rows: a.low.map((l) => [l.name, formatQty(l.stock, l.base_unit), formatQty(l.min_stock, l.base_unit)]) }, link: "/inventory" };
    },
  },
  {
    patterns: [/forecast/i, /demand/i, /next week/i],
    example: "What is the demand forecast for next week?",
    run: () => {
      const f = demandForecast(1);
      return { title: "Demand forecast (next week)", text: `Moving-average forecast: ~${f.total_forecast} meals; active subscriptions guarantee at least ${f.subscription_floor}.`, table: { columns: ["Meal", "Last 4 weeks", "Forecast"], rows: f.per_meal.slice(0, 10).map((r) => [r.name, r.q, r.forecast]) }, link: "/production" };
    },
  },
];

export const EXAMPLE_QUESTIONS = intents.map((i) => i.example);

export function ask(question: string): Answer {
  const q = question.trim();
  for (const intent of intents) if (intent.patterns.some((p) => p.test(q))) return intent.run(q);
  return { title: "I can help with these questions", text: "Try one of: " + EXAMPLE_QUESTIONS.join(" · ") };
}
