import { getDb, getSettingNumber } from "../db";
import type { MealPlanRow, MealPlanItemRow, OrderRow, OrderItemRow, SubscriptionRow, PackageRow, PaymentRow, ExpenseRow, FeedbackRow, Slot } from "../types";
import { parseJson, DAY_NAMES } from "../types";
import { getClientFull, clientPrefsParsed, recomputeTargets } from "./clients";
import { mealProfiles } from "./meals";
import { generatePlan, auditPlan, planTotals, slotsFor, type PlanItem, type DayAudit } from "../planner";
import type { ClientContext, MealProfile } from "../recommend";
import { audit } from "../audit";
import { emit } from "../automation";
import { aggregateRequirements, type Demand, type RecipeLineLite, type IngredientLite, type GroceryLine } from "../grocery";
import { stockByIngredient, bestPrices, listIngredients } from "./meals";
import { ensureBatchesForOrder, ensureDeliveryForOrder } from "./production";

// ------------------------------------------------------------- client context
export function clientContext(clientId: number): { ctx: ClientContext; full: NonNullable<ReturnType<typeof getClientFull>> } {
  const full = getClientFull(clientId);
  if (!full) throw new Error("Client not found");
  const p = clientPrefsParsed(full.prefs);
  const t = full.computed;
  const slot_kcal: Record<string, number | null> = {};
  for (const d of t.meal_distribution) slot_kcal[d.slot] = d.kcal;
  const ctx: ClientContext = {
    slot_kcal,
    protein_target: t.protein_g,
    calories_target: t.calories_target,
    dietary_pattern: full.prefs?.dietary_pattern ?? "omnivore",
    dietary_tags: p.dietary_tags,
    cuisines: p.cuisines,
    liked: p.liked,
    disliked: p.disliked,
    allergens: full.allergies.map((a) => ({ allergen: a.allergen, kind: a.kind, severity: a.severity })),
    budget_per_meal: full.prefs?.budget_per_meal_zar ?? null,
    requires_professional_review: t.requires_professional_review && !full.reviews.some((r) => r.outcome.startsWith("approved")),
    cooking_preference: full.prefs?.cooking_preference ?? "ready_to_heat",
  };
  return { ctx, full };
}

// ------------------------------------------------------------- meal plans
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function generateAndSavePlan(clientId: number, weekStart: string, opts: { meals_per_day?: number; include_snacks?: boolean; goal_type?: string; budget_zar?: number | null; notes?: string }, userId: number | null): number {
  const db = getDb();
  const { ctx, full } = clientContext(clientId);
  const meals = mealProfiles(clientId);
  const mealsPerDay = opts.meals_per_day ?? full.prefs?.meals_per_day ?? 3;
  const includeSnacks = opts.include_snacks ?? !!(full.prefs?.include_snacks ?? 1);
  const t = full.computed;
  const plan = generatePlan(meals, ctx, {
    meals_per_day: mealsPerDay, include_snacks: includeSnacks, budget_per_week: opts.budget_zar ?? full.prefs?.budget_per_week_zar ?? null,
    targets: { calories_min: t.calories_min, calories_max: t.calories_max, protein_g: t.protein_g, fibre_g: t.fibre_g, carbs_max_g: t.carbs_max_g, fat_max_g: t.fat_max_g },
  });
  const week = mondayOf(weekStart);
  const id = db.transaction(() => {
    const r = db.prepare("INSERT INTO meal_plans (client_id, week_start, status, goal_type, meals_per_day, include_snacks, budget_zar, notes, created_by) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)")
      .run(clientId, week, opts.goal_type ?? full.goals[0]?.goal_type ?? "", mealsPerDay, includeSnacks ? 1 : 0, opts.budget_zar ?? null, opts.notes ?? "", userId);
    const planId = Number(r.lastInsertRowid);
    const ins = db.prepare("INSERT INTO meal_plan_items (plan_id, day_index, slot, meal_id, portion_multiplier, reasons_json) VALUES (?, ?, ?, ?, 1, ?)");
    for (const it of plan.items) ins.run(planId, it.day_index, it.slot, it.meal.id, JSON.stringify(it.reasons));
    return planId;
  })();
  audit(userId, "create", "meal_plan", id, `week ${week}, ${plan.items.length} items`);
  return id;
}

export type PlanFull = {
  plan: MealPlanRow;
  items: (MealPlanItemRow & { meal: MealProfile; reasons: string[] })[];
  audits: DayAudit[];
  totals: ReturnType<typeof planTotals>;
  suggestions: string[];
  slots: Slot[];
  client: { id: number; name: string };
  targets: NonNullable<ReturnType<typeof getClientFull>>["computed"];
};

export function getPlanFull(planId: number): PlanFull | null {
  const db = getDb();
  const plan = db.prepare("SELECT * FROM meal_plans WHERE id = ?").get(planId) as MealPlanRow | undefined;
  if (!plan) return null;
  const rows = db.prepare("SELECT * FROM meal_plan_items WHERE plan_id = ? ORDER BY day_index, CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'snack' THEN 2 ELSE 3 END").all(planId) as MealPlanItemRow[];
  const profiles = new Map(mealProfiles(plan.client_id).map((m) => [m.id, m]));
  const full = getClientFull(plan.client_id)!;
  const t = full.computed;
  const items = rows.filter((r) => profiles.has(r.meal_id)).map((r) => ({ ...r, meal: scaleProfile(profiles.get(r.meal_id)!, r.portion_multiplier), reasons: parseJson<string[]>(r.reasons_json, []) }));
  const planItems: PlanItem[] = items.map((i) => ({ day_index: i.day_index, slot: i.slot, meal: i.meal, score: 0, reasons: i.reasons, cautions: [] }));
  const opts = { meals_per_day: plan.meals_per_day, include_snacks: !!plan.include_snacks, targets: { calories_min: t.calories_min, calories_max: t.calories_max, protein_g: t.protein_g, fibre_g: t.fibre_g, carbs_max_g: t.carbs_max_g, fat_max_g: t.fat_max_g } };
  const audits = auditPlan(planItems, opts);
  const suggestions = buildSuggestionsFromAudits(audits, [...profiles.values()]);
  return { plan, items, audits, totals: planTotals(audits), suggestions, slots: slotsFor(plan.meals_per_day, !!plan.include_snacks), client: { id: full.client.id, name: `${full.client.first_name} ${full.client.last_name}` }, targets: t };
}

function buildSuggestionsFromAudits(audits: DayAudit[], meals: MealProfile[]): string[] {
  const out: string[] = [];
  const proteinDays = audits.filter((a) => a.gaps.some((g) => g.startsWith("Protein")));
  if (proteinDays.length) {
    const best = meals.filter((m) => ["snack", "lunch", "dinner"].includes(m.category)).sort((a, b) => b.nutrition.protein - a.nutrition.protein)[0];
    if (best) out.push(`Protein is below target on ${proteinDays.map((d) => d.day).join(", ")}. Swap in or add "${best.name}" (${best.nutrition.protein} g protein) or raise the portion multiplier on the main meal.`);
  }
  const fibreDays = audits.filter((a) => a.gaps.some((g) => g.startsWith("Fibre")));
  if (fibreDays.length) out.push(`Fibre is below target on ${fibreDays.map((d) => d.day).join(", ")}: choose a legume- or vegetable-rich option for one slot.`);
  const high = audits.filter((a) => a.gaps.some((g) => g.startsWith("Energy is above")));
  if (high.length) out.push(`Energy is above range on ${high.map((d) => d.day).join(", ")}: reduce the portion multiplier to 0.75 on one meal or swap dinner for a lighter option.`);
  const low = audits.filter((a) => a.gaps.some((g) => g.startsWith("Energy is below")));
  if (low.length) out.push(`Energy is below range on ${low.map((d) => d.day).join(", ")}: raise the portion multiplier to 1.25 or add a snack.`);
  return out;
}

function scaleProfile(m: MealProfile, mult: number): MealProfile {
  if (mult === 1) return m;
  const n = m.nutrition;
  return { ...m, nutrition: { kcal: Math.round(n.kcal * mult), protein: r1(n.protein * mult), carbs: r1(n.carbs * mult), fat: r1(n.fat * mult), fibre: r1(n.fibre * mult), sodium_mg: Math.round(n.sodium_mg * mult), sugar: r1(n.sugar * mult) }, cost: r2(m.cost * mult), price: r2(m.price * mult) };
}
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function listPlans(clientId?: number) {
  const db = getDb();
  const sql = `SELECT p.*, c.first_name || ' ' || c.last_name AS client_name, (SELECT COUNT(*) FROM meal_plan_items i WHERE i.plan_id = p.id) AS items
                 FROM meal_plans p JOIN clients c ON c.id = p.client_id ${clientId ? "WHERE p.client_id = ?" : ""} ORDER BY p.week_start DESC, p.id DESC`;
  return (clientId ? db.prepare(sql).all(clientId) : db.prepare(sql).all()) as (MealPlanRow & { client_name: string; items: number })[];
}

export function setPlanItem(planId: number, dayIndex: number, slot: Slot, mealId: number | null, portion: number, userId: number | null) {
  const db = getDb();
  db.prepare("DELETE FROM meal_plan_items WHERE plan_id = ? AND day_index = ? AND slot = ?").run(planId, dayIndex, slot);
  if (mealId) db.prepare("INSERT INTO meal_plan_items (plan_id, day_index, slot, meal_id, portion_multiplier, reasons_json) VALUES (?, ?, ?, ?, ?, '[\"Selected manually by the planner.\"]')").run(planId, dayIndex, slot, mealId, portion);
  audit(userId, "update", "meal_plan", planId, `${DAY_NAMES[dayIndex]} ${slot} → ${mealId ?? "removed"}`);
}

export function setPlanStatus(planId: number, status: string, userId: number | null) {
  const db = getDb();
  const plan = db.prepare("SELECT * FROM meal_plans WHERE id = ?").get(planId) as MealPlanRow | undefined;
  if (!plan) return;
  db.prepare("UPDATE meal_plans SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END WHERE id = ?").run(status, status, planId);
  audit(userId, "status", "meal_plan", planId, status);
  if (status === "proposed") emit("plan.proposed", { client_id: plan.client_id, plan_id: planId, week_start: plan.week_start });
  if (status === "approved") emit("plan.approved", { client_id: plan.client_id, plan_id: planId });
}

// ------------------------------------------------------------- orders
export function nextOrderNumber(): string {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
  const y = new Date().getFullYear();
  return `ORD-${y}-${String(row.n + 1).padStart(4, "0")}`;
}

export function createOrderFromPlan(planId: number, opts: { delivery_date: string; package_id?: number | null; subscription_id?: number | null; discount_zar?: number }, userId: number | null): number {
  const db = getDb();
  const full = getPlanFull(planId);
  if (!full) throw new Error("Plan not found");
  const client = getClientFull(full.plan.client_id)!;
  const deliveryFee = getSettingNumber("delivery_cost_per_order");
  const peopleServed = client.prefs?.people_served ?? 1;
  const id = db.transaction(() => {
    const subtotal = full.items.reduce((s, i) => s + i.meal.price * peopleServed, 0);
    const discount = opts.discount_zar ?? 0;
    const total = Math.max(0, subtotal - discount + deliveryFee);
    const r = db.prepare(
      `INSERT INTO orders (order_number, client_id, meal_plan_id, subscription_id, package_id, location_id, status, delivery_date, delivery_address, people_served, subtotal_zar, discount_zar, delivery_fee_zar, total_zar)
       VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?)`
    ).run(nextOrderNumber(), full.plan.client_id, planId, opts.subscription_id ?? null, opts.package_id ?? null, client.client.location_id, opts.delivery_date, client.client.delivery_address || client.client.address, peopleServed, r2(subtotal), discount, deliveryFee, r2(total));
    const orderId = Number(r.lastInsertRowid);
    const ins = db.prepare("INSERT INTO order_items (order_id, meal_id, meal_number, day_index, slot, quantity, portion_multiplier, unit_price_zar, unit_cost_zar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    full.items.forEach((it, i) => ins.run(orderId, it.meal_id, i + 1, it.day_index, it.slot, peopleServed, it.portion_multiplier, it.meal.price, it.meal.cost));
    db.prepare("UPDATE meal_plans SET status = 'ordered' WHERE id = ?").run(planId);
    db.prepare("UPDATE clients SET status = 'active' WHERE id = ? AND status IN ('lead','onboarding')").run(full.plan.client_id);
    return orderId;
  })();
  const order = getOrder(id)!;
  audit(userId, "create", "order", id, order.order.order_number);
  emit("order.created", { order_id: id, client_id: order.order.client_id, order_number: order.order.order_number, total: order.order.total_zar.toFixed(2) });
  return id;
}

export type OrderFull = { order: OrderRow; items: (OrderItemRow & { meal_name: string; category: string })[]; client: { id: number; name: string; phone: string; email: string }; payments: PaymentRow[]; paid: number; delivery: { id: number; status: string; driver: string | null; delivery_date: string; window_start: string; window_end: string } | null };

export function getOrder(id: number): OrderFull | null {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!order) return null;
  const items = db.prepare("SELECT oi.*, m.name AS meal_name, m.category FROM order_items oi JOIN meals m ON m.id = oi.meal_id WHERE oi.order_id = ? ORDER BY oi.meal_number").all(id) as OrderFull["items"];
  const c = db.prepare("SELECT id, first_name || ' ' || last_name AS name, phone, email FROM clients WHERE id = ?").get(order.client_id) as OrderFull["client"];
  const payments = db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at").all(id) as PaymentRow[];
  const paid = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount_zar, 0);
  const delivery = (db.prepare("SELECT d.id, d.status, u.name AS driver, d.delivery_date, d.window_start, d.window_end FROM deliveries d LEFT JOIN users u ON u.id = d.driver_id WHERE d.order_id = ?").get(id) as OrderFull["delivery"]) ?? null;
  return { order, items, client: c, payments, paid, delivery };
}

export function listOrders(opts: { status?: string; clientId?: number; from?: string; to?: string; q?: string } = {}) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (opts.status) { where.push("o.status = ?"); params.push(opts.status); }
  if (opts.clientId) { where.push("o.client_id = ?"); params.push(opts.clientId); }
  if (opts.from) { where.push("o.delivery_date >= ?"); params.push(opts.from); }
  if (opts.to) { where.push("o.delivery_date <= ?"); params.push(opts.to); }
  if (opts.q) { where.push("(o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)"); params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`); }
  return getDb().prepare(
    `SELECT o.*, c.first_name || ' ' || c.last_name AS client_name, (SELECT COALESCE(SUM(quantity),0) FROM order_items i WHERE i.order_id = o.id) AS meals,
            (SELECT d.status FROM deliveries d WHERE d.order_id = o.id) AS delivery_status
       FROM orders o JOIN clients c ON c.id = o.client_id WHERE ${where.join(" AND ")} ORDER BY o.delivery_date DESC, o.id DESC`
  ).all(...params) as (OrderRow & { client_name: string; meals: number; delivery_status: string | null })[];
}

export function setOrderStatus(orderId: number, status: string, userId: number | null) {
  const db = getDb();
  const o = getOrder(orderId);
  if (!o) return;
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, orderId);
  audit(userId, "status", "order", orderId, status);
  emit("order.status_changed", { order_id: orderId, client_id: o.order.client_id, status });
  if (status === "preparing") emit("production.started", { order_id: orderId, client_id: o.order.client_id });
}

export function recordPayment(p: { order_id: number | null; client_id: number; subscription_id?: number | null; amount_zar: number; method: string; reference: string; notes?: string }, userId: number | null): number {
  const db = getDb();
  const id = Number(db.prepare("INSERT INTO payments (order_id, client_id, subscription_id, amount_zar, method, reference, status, notes) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)")
    .run(p.order_id, p.client_id, p.subscription_id ?? null, p.amount_zar, p.method, p.reference, p.notes ?? "").lastInsertRowid);
  audit(userId, "payment", "order", p.order_id, `R${p.amount_zar}`);
  if (p.order_id) {
    const o = getOrder(p.order_id)!;
    const status = o.paid >= o.order.total_zar - 0.01 ? "paid" : "partial";
    db.prepare("UPDATE orders SET payment_status = ?, status = CASE WHEN ? = 'paid' AND status IN ('inquiry','quote_sent','awaiting_payment') THEN 'paid' ELSE status END, updated_at = datetime('now') WHERE id = ?").run(status, status, p.order_id);
    if (status === "paid") {
      emit("payment.received", { order_id: p.order_id, client_id: p.client_id, order_number: o.order.order_number, amount: p.amount_zar });
      ensureBatchesForOrder(p.order_id, userId);
      ensureDeliveryForOrder(p.order_id, userId);
    }
  }
  return id;
}

export function listPayments(opts: { from?: string; to?: string } = {}) {
  const where: string[] = ["1=1"]; const params: unknown[] = [];
  if (opts.from) { where.push("p.paid_at >= ?"); params.push(opts.from); }
  if (opts.to) { where.push("p.paid_at <= ?"); params.push(opts.to + "T23:59:59"); }
  return getDb().prepare(`SELECT p.*, c.first_name || ' ' || c.last_name AS client_name, o.order_number FROM payments p JOIN clients c ON c.id = p.client_id LEFT JOIN orders o ON o.id = p.order_id WHERE ${where.join(" AND ")} ORDER BY p.paid_at DESC`).all(...params) as (PaymentRow & { client_name: string; order_number: string | null })[];
}

export function pendingPayments() {
  return listOrders().filter((o) => o.payment_status !== "paid" && !["cancelled", "inquiry"].includes(o.status));
}

export function addExpense(e: { category: string; description: string; amount_zar: number; incurred_at: string; supplier_id?: number | null; is_recurring?: boolean }, userId: number | null): number {
  const id = Number(getDb().prepare("INSERT INTO expenses (category, description, amount_zar, incurred_at, supplier_id, is_recurring) VALUES (?, ?, ?, ?, ?, ?)").run(e.category, e.description, e.amount_zar, e.incurred_at, e.supplier_id ?? null, e.is_recurring ? 1 : 0).lastInsertRowid);
  audit(userId, "create", "expense", id, `${e.category} R${e.amount_zar}`);
  return id;
}

export function listExpenses(opts: { from?: string; to?: string } = {}) {
  const where: string[] = ["1=1"]; const params: unknown[] = [];
  if (opts.from) { where.push("incurred_at >= ?"); params.push(opts.from); }
  if (opts.to) { where.push("incurred_at <= ?"); params.push(opts.to); }
  return getDb().prepare(`SELECT * FROM expenses WHERE ${where.join(" AND ")} ORDER BY incurred_at DESC, id DESC`).all(...params) as ExpenseRow[];
}

// ------------------------------------------------------------- grocery
/** Demand across orders in a date window (paid or later, not yet delivered) or for a single plan/order. */
export function groceryForOrders(opts: { from: string; to: string; statuses?: string[] }): { lines: GroceryLine[]; orders: number; meals: number } {
  const db = getDb();
  const statuses = opts.statuses ?? ["paid", "plan_created", "shopping", "preparing"];
  const rows = db.prepare(
    `SELECT oi.meal_id, SUM(oi.quantity) AS servings, oi.portion_multiplier, COUNT(DISTINCT o.id) AS orders
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.delivery_date BETWEEN ? AND ? AND o.status IN (${statuses.map(() => "?").join(",")})
      GROUP BY oi.meal_id, oi.portion_multiplier`
  ).all(opts.from, opts.to, ...statuses) as { meal_id: number; servings: number; portion_multiplier: number }[];
  const orders = (db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE delivery_date BETWEEN ? AND ? AND status IN (${statuses.map(() => "?").join(",")})`).get(opts.from, opts.to, ...statuses) as { n: number }).n;
  const demand: Demand[] = rows.map((r) => ({ meal_id: r.meal_id, servings: r.servings, portion_multiplier: r.portion_multiplier }));
  return { lines: groceryForDemand(demand), orders, meals: rows.reduce((s, r) => s + r.servings, 0) };
}

export function groceryForPlan(planId: number): GroceryLine[] {
  const rows = getDb().prepare("SELECT meal_id, portion_multiplier, COUNT(*) AS n FROM meal_plan_items WHERE plan_id = ? GROUP BY meal_id, portion_multiplier").all(planId) as { meal_id: number; portion_multiplier: number; n: number }[];
  const plan = getDb().prepare("SELECT client_id FROM meal_plans WHERE id = ?").get(planId) as { client_id: number } | undefined;
  const people = plan ? ((getDb().prepare("SELECT people_served FROM client_preferences WHERE client_id = ?").get(plan.client_id) as { people_served: number } | undefined)?.people_served ?? 1) : 1;
  return groceryForDemand(rows.map((r) => ({ meal_id: r.meal_id, servings: r.n * people, portion_multiplier: r.portion_multiplier })));
}

export function groceryForDemand(demand: Demand[]): GroceryLine[] {
  const db = getDb();
  const lines = db.prepare("SELECT ri.meal_id, ri.ingredient_id, ri.quantity, m.servings AS recipe_servings FROM recipe_ingredients ri JOIN meals m ON m.id = ri.meal_id").all() as RecipeLineLite[];
  const stock = stockByIngredient();
  const prices = bestPrices();
  const ingredients = new Map<number, IngredientLite>();
  for (const i of listIngredients(false)) ingredients.set(i.id, { id: i.id, name: i.name, category: i.category, base_unit: i.base_unit, waste_pct: i.waste_pct, stock: stock.get(i.id) ?? 0, best_price: prices.get(i.id)?.price ?? null, best_supplier: prices.get(i.id)?.supplier ?? null, min_stock: i.min_stock });
  const names = new Map((db.prepare("SELECT id, name FROM meals").all() as { id: number; name: string }[]).map((m) => [m.id, m.name]));
  return aggregateRequirements(demand, lines, ingredients, names, getSettingNumber("default_waste_pct"));
}

// ------------------------------------------------------------- packages & subscriptions
export function listPackages(activeOnly = true): PackageRow[] {
  return getDb().prepare(`SELECT * FROM packages ${activeOnly ? "WHERE is_active = 1" : ""} ORDER BY sort_order, meals_per_week`).all() as PackageRow[];
}

export function upsertPackage(p: Partial<PackageRow> & { id?: number }, userId: number | null) {
  const db = getDb();
  const cols = ["code", "name", "description", "meals_per_week", "price_zar", "is_custom", "is_active", "sort_order"] as const;
  const present = cols.filter((c) => p[c] !== undefined);
  if (p.id) { db.prepare(`UPDATE packages SET ${present.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...present.map((c) => p[c] as unknown), p.id); audit(userId, "update", "package", p.id, ""); return p.id; }
  const r = db.prepare(`INSERT INTO packages (${present.join(", ")}) VALUES (${present.map(() => "?").join(", ")})`).run(...present.map((c) => p[c] as unknown));
  audit(userId, "create", "package", Number(r.lastInsertRowid), p.name ?? "");
  return Number(r.lastInsertRowid);
}

export function listSubscriptions(clientId?: number) {
  const sql = `SELECT s.*, c.first_name || ' ' || c.last_name AS client_name, p.name AS package_name FROM subscriptions s JOIN clients c ON c.id = s.client_id LEFT JOIN packages p ON p.id = s.package_id ${clientId ? "WHERE s.client_id = ?" : ""} ORDER BY s.status = 'active' DESC, s.renewal_date`;
  return (clientId ? getDb().prepare(sql).all(clientId) : getDb().prepare(sql).all()) as (SubscriptionRow & { client_name: string; package_name: string | null })[];
}

export function createSubscription(s: { client_id: number; package_id: number | null; meals_per_week: number; frequency: string; price_per_cycle: number; start_date: string }, userId: number | null): number {
  const renewal = nextRenewal(s.start_date, s.frequency);
  const weeks = s.frequency === "monthly" ? 4 : s.frequency === "biweekly" ? 2 : 1;
  const id = Number(getDb().prepare("INSERT INTO subscriptions (client_id, package_id, meals_per_week, frequency, price_per_cycle, start_date, renewal_date, status, meals_remaining) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)")
    .run(s.client_id, s.package_id, s.meals_per_week, s.frequency, s.price_per_cycle, s.start_date, renewal, s.meals_per_week * weeks).lastInsertRowid);
  getDb().prepare("INSERT INTO subscription_events (subscription_id, event_type, notes) VALUES (?, 'renewed', 'Subscription started')").run(id);
  audit(userId, "create", "subscription", id, `${s.meals_per_week}/${s.frequency}`);
  return id;
}

export function nextRenewal(from: string, frequency: string): string {
  const d = new Date(from + "T00:00:00");
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + (frequency === "biweekly" ? 14 : 7));
  return d.toISOString().slice(0, 10);
}

export function subscriptionAction(id: number, action: "skip" | "pause" | "resume" | "cancel" | "renew", userId: number | null, weekStart?: string) {
  const db = getDb();
  const s = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as SubscriptionRow | undefined;
  if (!s) return;
  if (action === "skip") { db.prepare("UPDATE subscriptions SET renewal_date = ? WHERE id = ?").run(nextRenewal(s.renewal_date, "weekly"), id); db.prepare("INSERT INTO subscription_events (subscription_id, event_type, week_start) VALUES (?, 'skipped', ?)").run(id, weekStart ?? s.renewal_date); }
  if (action === "pause") { db.prepare("UPDATE subscriptions SET status = 'paused', paused_at = datetime('now') WHERE id = ?").run(id); db.prepare("INSERT INTO subscription_events (subscription_id, event_type) VALUES (?, 'paused')").run(id); }
  if (action === "resume") { db.prepare("UPDATE subscriptions SET status = 'active', paused_at = NULL, renewal_date = ? WHERE id = ?").run(nextRenewal(new Date().toISOString().slice(0, 10), s.frequency), id); db.prepare("INSERT INTO subscription_events (subscription_id, event_type) VALUES (?, 'resumed')").run(id); }
  if (action === "cancel") { db.prepare("UPDATE subscriptions SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?").run(id); db.prepare("INSERT INTO subscription_events (subscription_id, event_type) VALUES (?, 'cancelled')").run(id); }
  if (action === "renew") {
    const weeks = s.frequency === "monthly" ? 4 : s.frequency === "biweekly" ? 2 : 1;
    db.prepare("UPDATE subscriptions SET renewal_date = ?, meals_remaining = meals_remaining + ?, status = 'active' WHERE id = ?").run(nextRenewal(s.renewal_date, s.frequency), s.meals_per_week * weeks, id);
    db.prepare("INSERT INTO subscription_events (subscription_id, event_type) VALUES (?, 'renewed')").run(id);
    emit("subscription.renewed", { subscription_id: id, client_id: s.client_id });
  }
  audit(userId, action, "subscription", id, "");
}

export function subscriptionEvents(id: number) {
  return getDb().prepare("SELECT * FROM subscription_events WHERE subscription_id = ? ORDER BY created_at DESC").all(id) as { id: number; event_type: string; week_start: string | null; notes: string; created_at: string }[];
}

// ------------------------------------------------------------- feedback
export function addFeedback(f: Omit<FeedbackRow, "id" | "created_at">): number {
  const id = Number(getDb().prepare("INSERT INTO feedback (client_id, order_id, meal_id, taste, portion, presentation, variety, packaging, overall, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(f.client_id, f.order_id, f.meal_id, f.taste, f.portion, f.presentation, f.variety, f.packaging, f.overall, f.comment).lastInsertRowid);
  emit("feedback.received", { feedback_id: id, client_id: f.client_id, meal_id: f.meal_id, overall: f.overall });
  return id;
}

export function listFeedback(limit = 200) {
  return getDb().prepare("SELECT f.*, c.first_name || ' ' || c.last_name AS client_name, m.name AS meal_name FROM feedback f JOIN clients c ON c.id = f.client_id LEFT JOIN meals m ON m.id = f.meal_id ORDER BY f.created_at DESC LIMIT ?").all(limit) as (FeedbackRow & { client_name: string; meal_name: string | null })[];
}

export function feedbackInsights() {
  const db = getDb();
  const byMeal = db.prepare(
    `SELECT m.id, m.name, COUNT(f.id) AS n, AVG(f.overall) AS overall, AVG(f.taste) AS taste, AVG(f.portion) AS portion, AVG(f.presentation) AS presentation, AVG(f.variety) AS variety, AVG(f.packaging) AS packaging
       FROM meals m JOIN feedback f ON f.meal_id = m.id GROUP BY m.id HAVING n >= 1 ORDER BY overall DESC`
  ).all() as { id: number; name: string; n: number; overall: number; taste: number; portion: number; presentation: number; variety: number; packaging: number }[];
  const avg = db.prepare("SELECT AVG(overall) AS overall, AVG(taste) AS taste, AVG(portion) AS portion, AVG(presentation) AS presentation, AVG(variety) AS variety, AVG(packaging) AS packaging, COUNT(*) AS n FROM feedback").get() as { overall: number | null; taste: number | null; portion: number | null; presentation: number | null; variety: number | null; packaging: number | null; n: number };
  const promote = byMeal.filter((m) => m.overall >= 4.3 && m.n >= 2);
  const remove = byMeal.filter((m) => m.overall <= 2.8 && m.n >= 2);
  return { byMeal, avg, promote, remove };
}

export { recomputeTargets };
