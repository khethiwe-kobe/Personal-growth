"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate, createSession, getSessionUser, assertPermission, hashPassword, type Permission } from "@/lib/auth";
import { getDb, setSetting } from "@/lib/db";
import { audit } from "@/lib/audit";
import * as Clients from "@/lib/repo/clients";
import * as Meals from "@/lib/repo/meals";
import * as Orders from "@/lib/repo/orders";
import * as Inv from "@/lib/repo/inventory";
import * as Prod from "@/lib/repo/production";
import { runScheduledChecks } from "@/lib/automation";
import { markSent, ADAPTERS } from "@/lib/comms";
import type { ProductionStatus, DeliveryStatus, Slot } from "@/lib/types";

const s = (fd: FormData, k: string, d = "") => String(fd.get(k) ?? d).trim();
const n = (fd: FormData, k: string): number | null => { const v = s(fd, k); if (v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
const i = (fd: FormData, k: string, d = 0) => Math.round(n(fd, k) ?? d);
const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true";
const list = (fd: FormData, k: string) => s(fd, k).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

async function guard(perm: Permission) {
  const user = await getSessionUser();
  assertPermission(user, perm);
  return user;
}

// ---------------------------------------------------------------- auth
export async function login(fd: FormData) {
  const user = authenticate(s(fd, "email"), s(fd, "password"));
  if (!user) redirect("/login?error=" + encodeURIComponent("Incorrect email or password."));
  await createSession(user.id);
  audit(user.id, "login", "user", user.id);
  redirect(user.role === "client" ? "/portal" : "/dashboard");
}

// ---------------------------------------------------------------- clients
export async function updateClientPersonal(fd: FormData) {
  const u = await guard("clients:edit");
  const id = i(fd, "id");
  Clients.updateClientSection(id, "clients", {
    first_name: s(fd, "first_name"), last_name: s(fd, "last_name"), email: s(fd, "email"), phone: s(fd, "phone"), date_of_birth: s(fd, "date_of_birth") || null,
    gender: s(fd, "gender", "unspecified"), address: s(fd, "address"), delivery_address: s(fd, "delivery_address"), delivery_notes: s(fd, "delivery_notes"),
    emergency_contact: s(fd, "emergency_contact"), status: s(fd, "status", "active"), source: s(fd, "source"), notes: s(fd, "notes"),
  }, u.id);
  revalidatePath(`/clients/${id}`);
}

export async function updateClientHealth(fd: FormData) {
  const u = await guard("health:edit");
  const id = i(fd, "id");
  Clients.updateClientSection(id, "client_health_profiles", {
    height_cm: n(fd, "height_cm"), weight_kg: n(fd, "weight_kg"), target_weight_kg: n(fd, "target_weight_kg"), activity_level: s(fd, "activity_level", "moderate"),
    fitness_level: s(fd, "fitness_level"), blood_type: s(fd, "blood_type"), training_schedule: s(fd, "training_schedule"), lifestyle: s(fd, "lifestyle"),
    sleep_hours: n(fd, "sleep_hours"), water_litres: n(fd, "water_litres"), stress_level: s(fd, "stress_level"), is_pregnant: b(fd, "is_pregnant") ? 1 : 0,
    is_breastfeeding: b(fd, "is_breastfeeding") ? 1 : 0, medical_conditions: s(fd, "medical_conditions"), medications: s(fd, "medications"),
    eating_disorder_history: b(fd, "eating_disorder_history") ? 1 : 0, medically_restricted_diet: s(fd, "medically_restricted_diet"), other_notes: s(fd, "other_notes"),
  }, u.id);
  if (n(fd, "weight_kg")) getDb().prepare("INSERT INTO client_measurements (client_id, measured_at, weight_kg, notes) VALUES (?, date('now'), ?, 'Profile update')").run(id, n(fd, "weight_kg"));
  Clients.setPrimaryGoal(id, { goal_type: s(fd, "goal_type", "balanced"), description: s(fd, "goal_description"), target_value: n(fd, "target_weight_kg"), target_date: s(fd, "goal_target_date") || null }, u.id);
  revalidatePath(`/clients/${id}`);
}

export async function updateClientPreferences(fd: FormData) {
  const u = await guard("health:edit");
  const id = i(fd, "id");
  Clients.updateClientSection(id, "client_preferences", {
    dietary_pattern: s(fd, "dietary_pattern", "omnivore"), dietary_tags: JSON.stringify(fd.getAll("dietary_tags").map(String)), cuisines: JSON.stringify(list(fd, "cuisines")),
    liked_foods: JSON.stringify(list(fd, "liked_foods")), disliked_foods: JSON.stringify(list(fd, "disliked_foods")), meals_per_day: i(fd, "meals_per_day", 3), include_snacks: b(fd, "include_snacks") ? 1 : 0,
    people_served: i(fd, "people_served", 1), cooking_preference: s(fd, "cooking_preference", "ready_to_heat"), spice_level: s(fd, "spice_level", "medium"),
    budget_per_meal_zar: n(fd, "budget_per_meal_zar"), budget_per_week_zar: n(fd, "budget_per_week_zar"), preferred_delivery_days: JSON.stringify(fd.getAll("delivery_days").map(String)),
  }, u.id);
  const allergies: { kind: string; allergen: string; severity: string }[] = [];
  for (let k = 0; k < 8; k++) { const a = s(fd, `allergen_${k}`); if (a) allergies.push({ kind: s(fd, `kind_${k}`, "allergy"), allergen: a, severity: s(fd, `severity_${k}`, "moderate") }); }
  Clients.setAllergies(id, allergies, u.id);
  revalidatePath(`/clients/${id}`);
}

export async function addProfessionalReview(fd: FormData) {
  const u = await guard("health:edit");
  const id = i(fd, "client_id");
  Clients.recordProfessionalReview(id, { reviewer_name: s(fd, "reviewer_name"), reviewer_role: s(fd, "reviewer_role"), outcome: s(fd, "outcome", "pending"), notes: s(fd, "notes") }, u.id);
  revalidatePath(`/clients/${id}`);
}

export async function anonymiseClientAction(fd: FormData) {
  const u = await guard("clients:edit");
  Clients.anonymiseClient(i(fd, "client_id"), u.id);
  redirect("/clients");
}

export async function addProgressAction(fd: FormData) {
  const u = await getSessionUser();
  const clientId = u?.role === "client" ? u.client_id! : (assertPermission(u, "clients:edit"), i(fd, "client_id"));
  Clients.addProgress(clientId, { logged_at: s(fd, "logged_at") || new Date().toISOString().slice(0, 10), weight_kg: n(fd, "weight_kg"), waist_cm: n(fd, "waist_cm"), adherence_pct: n(fd, "adherence_pct"), energy: n(fd, "energy"), satisfaction: n(fd, "satisfaction"), water_litres: n(fd, "water_litres"), exercise_minutes: n(fd, "exercise_minutes"), notes: s(fd, "notes") });
  revalidatePath(u?.role === "client" ? "/portal/progress" : `/clients/${clientId}`);
}

// ---------------------------------------------------------------- meals
export async function saveMeal(fd: FormData) {
  const u = await guard("meals:edit");
  const id = n(fd, "id");
  const ov: Record<string, number> = {};
  for (const k of ["kcal", "protein", "carbs", "fat", "fibre"]) { const v = n(fd, `ov_${k}`); if (v != null) ov[k] = v; }
  const mealId = Meals.upsertMeal({
    id: id ?? undefined, name: s(fd, "name"), category: s(fd, "category", "lunch") as never, cuisine: s(fd, "cuisine"), description: s(fd, "description"),
    servings: i(fd, "servings", 4), serving_size_g: n(fd, "serving_size_g") ?? 400, prep_minutes: i(fd, "prep_minutes", 15), cook_minutes: i(fd, "cook_minutes", 30), cook_temp_c: n(fd, "cook_temp_c"),
    shelf_life_days: i(fd, "shelf_life_days", 4), storage: s(fd, "storage"), reheating: s(fd, "reheating"), food_safety_notes: s(fd, "food_safety_notes"),
    dietary_tags: JSON.stringify(fd.getAll("dietary_tags").map(String)), complexity: i(fd, "complexity", 2), bulk_friendly: b(fd, "bulk_friendly") ? 1 : 0,
    packaging_cost: n(fd, "packaging_cost") ?? 0, labour_minutes_per_serving: n(fd, "labour_minutes_per_serving") ?? 4, selling_price: n(fd, "selling_price") ?? 0,
    tier: s(fd, "tier", "standard"), image_url: s(fd, "image_url"), internal_rating: i(fd, "internal_rating", 4), nutrition_override: JSON.stringify(ov), is_active: b(fd, "is_active") ? 1 : 0,
  }, u.id);
  revalidatePath("/meals");
  redirect(`/meals/${mealId}`);
}

export async function saveRecipe(fd: FormData) {
  const u = await guard("meals:edit");
  const mealId = i(fd, "meal_id");
  const lines: { ingredient_id: number; quantity: number; note?: string }[] = [];
  for (let k = 0; k < 30; k++) { const ing = n(fd, `ing_${k}`); const q = n(fd, `qty_${k}`); if (ing && q) lines.push({ ingredient_id: ing, quantity: q, note: s(fd, `note_${k}`) }); }
  const steps = s(fd, "steps").split("\n").map((t) => t.trim()).filter(Boolean).map((text, idx) => ({ title: `Step ${idx + 1}`, text }));
  Meals.setRecipe(mealId, lines, steps, s(fd, "portion_note"), u.id);
  revalidatePath(`/meals/${mealId}`);
}

export async function saveIngredient(fd: FormData) {
  const u = await guard("meals:edit");
  Meals.upsertIngredient({
    id: n(fd, "id") ?? undefined, name: s(fd, "name"), category: s(fd, "category", "other") as never, base_unit: s(fd, "base_unit", "g") as never,
    kcal_per_100: n(fd, "kcal_per_100") ?? 0, protein_per_100: n(fd, "protein_per_100") ?? 0, carbs_per_100: n(fd, "carbs_per_100") ?? 0, fat_per_100: n(fd, "fat_per_100") ?? 0,
    fibre_per_100: n(fd, "fibre_per_100") ?? 0, sodium_mg_per_100: n(fd, "sodium_mg_per_100") ?? 0, sugar_per_100: n(fd, "sugar_per_100") ?? 0,
    allergens: JSON.stringify(fd.getAll("allergens").map(String)), default_cost_per_unit: n(fd, "default_cost_per_unit") ?? 0, waste_pct: n(fd, "waste_pct") ?? 5,
    min_stock: n(fd, "min_stock") ?? 0, storage: s(fd, "storage", "chilled"), is_active: 1,
  }, u.id);
  revalidatePath("/ingredients");
}

// ---------------------------------------------------------------- plans & orders
export async function generatePlanAction(fd: FormData) {
  const u = await guard("plans:edit");
  const id = Orders.generateAndSavePlan(i(fd, "client_id"), s(fd, "week_start"), { meals_per_day: n(fd, "meals_per_day") ?? undefined, include_snacks: fd.has("include_snacks") ? b(fd, "include_snacks") : undefined, goal_type: s(fd, "goal_type") || undefined, budget_zar: n(fd, "budget_zar"), notes: s(fd, "notes") }, u.id);
  redirect(`/meal-plans/${id}`);
}

export async function setPlanItemAction(fd: FormData) {
  const u = await guard("plans:edit");
  const planId = i(fd, "plan_id");
  Orders.setPlanItem(planId, i(fd, "day_index"), s(fd, "slot") as Slot, n(fd, "meal_id") || null, n(fd, "portion") ?? 1, u.id);
  revalidatePath(`/meal-plans/${planId}`);
}

export async function setPlanStatusAction(fd: FormData) {
  const u = await getSessionUser();
  const planId = i(fd, "plan_id");
  const status = s(fd, "status");
  if (u?.role === "client") {
    const plan = getDb().prepare("SELECT client_id FROM meal_plans WHERE id = ?").get(planId) as { client_id: number } | undefined;
    if (!plan || plan.client_id !== u.client_id || status !== "approved") throw new Error("Forbidden");
    Orders.setPlanStatus(planId, "approved", u.id);
    revalidatePath("/portal/plan");
    return;
  }
  assertPermission(u, "plans:edit");
  Orders.setPlanStatus(planId, status, u.id);
  revalidatePath(`/meal-plans/${planId}`);
}

export async function createOrderAction(fd: FormData) {
  const u = await guard("orders:edit");
  const id = Orders.createOrderFromPlan(i(fd, "plan_id"), { delivery_date: s(fd, "delivery_date"), package_id: n(fd, "package_id"), subscription_id: n(fd, "subscription_id"), discount_zar: n(fd, "discount_zar") ?? 0 }, u.id);
  redirect(`/orders/${id}`);
}

export async function setOrderStatusAction(fd: FormData) {
  const u = await guard("orders:edit");
  const id = i(fd, "order_id");
  Orders.setOrderStatus(id, s(fd, "status"), u.id);
  if (s(fd, "status") === "paid") { Prod.ensureBatchesForOrder(id, u.id); Prod.ensureDeliveryForOrder(id, u.id); }
  revalidatePath(`/orders/${id}`); revalidatePath("/orders");
}

export async function recordPaymentAction(fd: FormData) {
  const u = await guard("finance:edit");
  const orderId = n(fd, "order_id");
  const clientId = orderId ? (getDb().prepare("SELECT client_id FROM orders WHERE id = ?").get(orderId) as { client_id: number }).client_id : i(fd, "client_id");
  Orders.recordPayment({ order_id: orderId, client_id: clientId, amount_zar: n(fd, "amount_zar") ?? 0, method: s(fd, "method", "eft"), reference: s(fd, "reference"), notes: s(fd, "notes") }, u.id);
  revalidatePath("/payments"); if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function sendPaymentReminder(fd: FormData) {
  await guard("finance:edit");
  const o = Orders.getOrder(i(fd, "order_id"));
  if (o) { const { emit } = await import("@/lib/automation"); emit("payment.reminder", { order_id: o.order.id, client_id: o.order.client_id, order_number: o.order.order_number, total: o.order.total_zar.toFixed(2) }); }
  revalidatePath("/payments");
}

export async function addExpenseAction(fd: FormData) {
  const u = await guard("finance:edit");
  Orders.addExpense({ category: s(fd, "category", "other"), description: s(fd, "description"), amount_zar: n(fd, "amount_zar") ?? 0, incurred_at: s(fd, "incurred_at") || new Date().toISOString().slice(0, 10), supplier_id: n(fd, "supplier_id"), is_recurring: b(fd, "is_recurring") }, u.id);
  revalidatePath("/expenses");
}

// ---------------------------------------------------------------- subscriptions & packages
export async function createSubscriptionAction(fd: FormData) {
  const u = await guard("orders:edit");
  const pkgId = n(fd, "package_id");
  const pkg = pkgId ? Orders.listPackages(false).find((p) => p.id === pkgId) : null;
  const freq = s(fd, "frequency", "weekly");
  const mult = freq === "monthly" ? 4 : freq === "biweekly" ? 2 : 1;
  Orders.createSubscription({ client_id: i(fd, "client_id"), package_id: pkgId, meals_per_week: i(fd, "meals_per_week") || pkg?.meals_per_week || 10, frequency: freq, price_per_cycle: n(fd, "price_per_cycle") ?? (pkg ? pkg.price_zar * mult : 0), start_date: s(fd, "start_date") || new Date().toISOString().slice(0, 10) }, u.id);
  revalidatePath("/subscriptions");
}

export async function subscriptionActionForm(fd: FormData) {
  const u = await getSessionUser();
  const id = i(fd, "subscription_id");
  const action = s(fd, "action") as "skip" | "pause" | "resume" | "cancel" | "renew";
  if (u?.role === "client") {
    const sub = getDb().prepare("SELECT client_id FROM subscriptions WHERE id = ?").get(id) as { client_id: number } | undefined;
    if (!sub || sub.client_id !== u.client_id || !["skip", "pause", "resume", "cancel"].includes(action)) throw new Error("Forbidden");
    Orders.subscriptionAction(id, action, u.id, s(fd, "week_start") || undefined);
    revalidatePath("/portal/subscription");
    return;
  }
  assertPermission(u, "orders:edit");
  Orders.subscriptionAction(id, action, u.id, s(fd, "week_start") || undefined);
  revalidatePath("/subscriptions");
}

export async function savePackageAction(fd: FormData) {
  const u = await guard("settings:edit");
  Orders.upsertPackage({ id: n(fd, "id") ?? undefined, code: s(fd, "code").toUpperCase(), name: s(fd, "name"), description: s(fd, "description"), meals_per_week: i(fd, "meals_per_week", 10), price_zar: n(fd, "price_zar") ?? 0, is_custom: b(fd, "is_custom") ? 1 : 0, is_active: b(fd, "is_active") ? 1 : 0, sort_order: i(fd, "sort_order") }, u.id);
  revalidatePath("/settings"); revalidatePath("/pricing");
}

// ---------------------------------------------------------------- inventory & suppliers
export async function receiveLotAction(fd: FormData) {
  const u = await guard("inventory:edit");
  Inv.receiveLot({ ingredient_id: i(fd, "ingredient_id"), supplier_id: n(fd, "supplier_id"), batch_number: s(fd, "batch_number"), quantity: n(fd, "quantity") ?? 0, unit_cost: n(fd, "unit_cost") ?? 0, expiry_date: s(fd, "expiry_date") || null, storage_location: s(fd, "storage_location", "Walk-in fridge") }, u.id);
  revalidatePath("/inventory");
}
export async function wasteAction(fd: FormData) {
  const u = await guard("inventory:edit");
  Inv.recordWaste(i(fd, "lot_id"), n(fd, "quantity") ?? 0, s(fd, "reason"), u.id);
  revalidatePath("/inventory");
}
export async function adjustAction(fd: FormData) {
  const u = await guard("inventory:edit");
  Inv.adjustStock(i(fd, "lot_id"), n(fd, "quantity") ?? 0, s(fd, "reason"), u.id);
  revalidatePath("/inventory");
}
export async function saveSupplierAction(fd: FormData) {
  const u = await guard("suppliers:edit");
  const id = Inv.upsertSupplier({ id: n(fd, "id") ?? undefined, name: s(fd, "name"), contact_name: s(fd, "contact_name"), phone: s(fd, "phone"), email: s(fd, "email"), min_order_zar: n(fd, "min_order_zar") ?? 0, delivery_days: JSON.stringify(fd.getAll("delivery_days").map(String)), lead_time_days: i(fd, "lead_time_days", 1), reliability: i(fd, "reliability", 4), quality: i(fd, "quality", 4), notes: s(fd, "notes"), is_active: b(fd, "is_active") ? 1 : 0 }, u.id);
  revalidatePath("/suppliers"); redirect(`/suppliers/${id}`);
}
export async function setSupplierPriceAction(fd: FormData) {
  const u = await guard("suppliers:edit");
  Inv.setSupplierPrice(i(fd, "supplier_id"), i(fd, "ingredient_id"), n(fd, "price_per_unit") ?? 0, n(fd, "pack_size") ?? 1000, u.id);
  revalidatePath(`/suppliers/${i(fd, "supplier_id")}`); revalidatePath("/suppliers");
}
export async function createPurchaseOrderAction(fd: FormData) {
  const u = await guard("inventory:edit");
  const supplierId = i(fd, "supplier_id");
  const lines: { ingredient_id: number; quantity: number; price_per_unit: number }[] = [];
  for (const [k, v] of fd.entries()) { const m = k.match(/^qty_(\d+)$/); if (m && Number(v) > 0) lines.push({ ingredient_id: Number(m[1]), quantity: Number(v), price_per_unit: Number(fd.get(`price_${m[1]}`) ?? 0) }); }
  if (lines.length) Inv.createPurchaseOrder(supplierId, lines, u.id);
  revalidatePath("/grocery"); revalidatePath("/inventory"); redirect("/inventory?tab=purchases");
}
export async function receivePurchaseOrderAction(fd: FormData) {
  const u = await guard("inventory:edit");
  Inv.receivePurchaseOrder(i(fd, "po_id"), u.id);
  revalidatePath("/inventory");
}

// ---------------------------------------------------------------- production, labels, deliveries
export async function setBatchStatusAction(fd: FormData) {
  const u = await guard("production:edit");
  Prod.setBatchStatus(i(fd, "batch_id"), s(fd, "status") as ProductionStatus, u.id, { quantity_done: n(fd, "quantity_done") ?? undefined, quantity_wasted: n(fd, "quantity_wasted") ?? undefined, qc_notes: fd.has("qc_notes") ? s(fd, "qc_notes") : undefined, assigned_user_id: fd.has("assigned_user_id") ? n(fd, "assigned_user_id") : undefined });
  revalidatePath("/production"); revalidatePath("/orders");
}
export async function markPrintedAction(fd: FormData) {
  await guard("labels:print");
  Prod.markLabelsPrinted(i(fd, "order_id"));
  revalidatePath("/packaging");
}
export async function assignDriverAction(fd: FormData) {
  const u = await guard("deliveries:edit");
  Prod.assignDriver(i(fd, "delivery_id"), n(fd, "driver_id"), s(fd, "window_start", "08:00"), s(fd, "window_end", "12:00"), u.id);
  revalidatePath("/deliveries");
}
export async function setDeliveryStatusAction(fd: FormData) {
  const u = await guard("deliveries:edit");
  Prod.setDeliveryStatus(i(fd, "delivery_id"), s(fd, "status") as DeliveryStatus, u.id, { type: s(fd, "proof_type") || undefined, note: s(fd, "proof_note") || undefined, failure_reason: s(fd, "failure_reason") || undefined });
  revalidatePath("/deliveries"); revalidatePath("/orders");
}
export async function buildRouteAction(fd: FormData) {
  const u = await guard("deliveries:edit");
  Prod.buildRoute(s(fd, "date"), n(fd, "driver_id"), u.id);
  revalidatePath("/deliveries");
}

// ---------------------------------------------------------------- feedback (client or staff)
export async function addFeedbackAction(fd: FormData) {
  const u = await getSessionUser();
  const clientId = u?.role === "client" ? u.client_id! : (assertPermission(u, "clients:edit"), i(fd, "client_id"));
  const r = (k: string) => n(fd, k);
  Orders.addFeedback({ client_id: clientId, order_id: n(fd, "order_id"), meal_id: n(fd, "meal_id"), taste: r("taste"), portion: r("portion"), presentation: r("presentation"), variety: r("variety"), packaging: r("packaging"), overall: r("overall"), comment: s(fd, "comment") });
  revalidatePath(u?.role === "client" ? "/portal/feedback" : "/feedback");
}

// ---------------------------------------------------------------- settings, users, business
export async function saveSettingsAction(fd: FormData) {
  const u = await guard("settings:edit");
  for (const [k, v] of fd.entries()) if (k.startsWith("set_")) setSetting(k.slice(4), String(v));
  audit(u.id, "update", "business_settings", null, "");
  revalidatePath("/settings"); revalidatePath("/pricing");
}
export async function saveUserAction(fd: FormData) {
  const u = await guard("users:edit");
  const db = getDb();
  const id = n(fd, "id");
  const pw = s(fd, "password");
  if (id) {
    db.prepare("UPDATE users SET name = ?, email = ?, role = ?, phone = ?, is_active = ? WHERE id = ?").run(s(fd, "name"), s(fd, "email"), s(fd, "role", "kitchen"), s(fd, "phone"), b(fd, "is_active") ? 1 : 0, id);
    if (pw) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(pw), id);
  } else {
    db.prepare("INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)").run(s(fd, "email"), hashPassword(pw || "changeme"), s(fd, "name"), s(fd, "role", "kitchen"), s(fd, "phone"));
  }
  audit(u.id, id ? "update" : "create", "user", id, s(fd, "email"));
  revalidatePath("/settings");
}
export async function saveStartupCostAction(fd: FormData) {
  const u = await guard("business:edit");
  const db = getDb();
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^(estimate|actual)_(\d+)$/);
    if (m) db.prepare(`UPDATE startup_cost_items SET ${m[1]}_zar = ? WHERE id = ?`).run(String(v) === "" ? null : Number(v), Number(m[2]));
  }
  if (s(fd, "new_category")) db.prepare("INSERT INTO startup_cost_items (category, description, estimate_zar, sort_order) VALUES (?, ?, ?, 99)").run(s(fd, "new_category"), s(fd, "new_description"), n(fd, "new_estimate") ?? 0);
  audit(u.id, "update", "startup_cost_items", null, "");
  revalidatePath("/startup-costs");
}
export async function saveComplianceAction(fd: FormData) {
  const u = await guard("compliance:edit");
  getDb().prepare("UPDATE compliance_items SET status = ?, evidence = ?, reviewed_at = datetime('now') WHERE id = ?").run(s(fd, "status", "todo"), s(fd, "evidence"), i(fd, "id"));
  audit(u.id, "update", "compliance_item", i(fd, "id"), s(fd, "status"));
  revalidatePath("/compliance");
}
export async function saveCampaignAction(fd: FormData) {
  const u = await guard("marketing:edit");
  const db = getDb();
  const id = n(fd, "id");
  const vals = [s(fd, "name"), s(fd, "channel", "instagram"), s(fd, "start_date") || new Date().toISOString().slice(0, 10), s(fd, "end_date") || null, n(fd, "spend_zar") ?? 0, i(fd, "leads"), i(fd, "conversions"), i(fd, "orders"), n(fd, "revenue_zar") ?? 0, s(fd, "status", "active"), s(fd, "notes")];
  if (id) db.prepare("UPDATE marketing_campaigns SET name=?, channel=?, start_date=?, end_date=?, spend_zar=?, leads=?, conversions=?, orders=?, revenue_zar=?, status=?, notes=? WHERE id = ?").run(...vals, id);
  else db.prepare("INSERT INTO marketing_campaigns (name, channel, start_date, end_date, spend_zar, leads, conversions, orders, revenue_zar, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(...vals);
  audit(u.id, id ? "update" : "create", "marketing_campaign", id, s(fd, "name"));
  revalidatePath("/marketing");
}
export async function runChecksAction() {
  await guard("settings:edit");
  runScheduledChecks();
  revalidatePath("/automations"); revalidatePath("/dashboard");
}
export async function dispatchQueuedAction() {
  await guard("settings:edit");
  const rows = getDb().prepare("SELECT m.id, m.channel, m.subject, m.body, c.email, c.phone FROM communications m JOIN clients c ON c.id = m.client_id WHERE m.status = 'queued' LIMIT 50").all() as { id: number; channel: "whatsapp" | "email" | "sms"; subject: string; body: string; email: string; phone: string }[];
  for (const r of rows) { const res = await ADAPTERS[r.channel](r.channel === "email" ? r.email : r.phone, r.subject, r.body); markSent(r.id, res.ok ? "sent" : "skipped", res.ref); }
  revalidatePath("/automations");
}
export async function updatePortalProfileAction(fd: FormData) {
  const u = await getSessionUser();
  if (!u || u.role !== "client" || !u.client_id) throw new Error("Forbidden");
  Clients.updateClientSection(u.client_id, "clients", { phone: s(fd, "phone"), delivery_address: s(fd, "delivery_address"), delivery_notes: s(fd, "delivery_notes"), emergency_contact: s(fd, "emergency_contact") }, u.id);
  Clients.updateClientSection(u.client_id, "client_preferences", { liked_foods: JSON.stringify(list(fd, "liked_foods")), disliked_foods: JSON.stringify(list(fd, "disliked_foods")), cuisines: JSON.stringify(list(fd, "cuisines")), spice_level: s(fd, "spice_level", "medium") }, u.id);
  revalidatePath("/portal/profile");
}
