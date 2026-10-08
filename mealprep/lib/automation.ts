import { getDb } from "./db";
import { queueMessage, type TemplateKey } from "./comms";

/**
 * Automation event bus. Every meaningful business change is emitted here.
 * Handlers run synchronously in-process (small business) and the event is
 * persisted to automation_events so an outbound webhook (Make.com, Zapier,
 * n8n, Google Sheets) can consume the same stream later.
 *
 * Event → handler map (requirement 41):
 *  client.created          → welcome message, staff notification, review flag
 *  assessment.received     → "assessment received" message
 *  plan.proposed           → "meal plan ready" message
 *  plan.approved           → (order created by caller)
 *  order.created           → order confirmation, grocery requirements implicit
 *  payment.received        → production queue (batches), status → paid
 *  production.started      → "preparation started"
 *  order.ready             → delivery record exists
 *  delivery.completed      → "delivered" + feedback request
 *  inventory.low           → purchasing alert
 *  subscription.ending     → renewal notification
 *  meal.cost_changed       → pricing review flag
 */
export type EventType =
  | "client.created" | "assessment.received" | "plan.proposed" | "plan.approved" | "order.created" | "order.status_changed"
  | "payment.received" | "payment.reminder" | "production.started" | "order.ready" | "delivery.scheduled" | "delivery.completed"
  | "inventory.low" | "inventory.expiring" | "subscription.ending" | "subscription.renewed" | "meal.cost_changed" | "feedback.received";

type Handler = (payload: Record<string, unknown>) => string | void;

const handlers: Partial<Record<EventType, Handler[]>> = {
  "client.created": [
    (p) => { queueMessage(Number(p.client_id), "welcome"); return "welcome_message"; },
    (p) => { notifyStaff(["admin", "planner"], "New client", `A new client has completed onboarding${p.requires_professional_review ? " — professional review recommended" : ""}.`, `/clients/${p.client_id}`); return "staff_notification"; },
  ],
  "assessment.received": [(p) => { queueMessage(Number(p.client_id), "assessment_received"); return "assessment_message"; }],
  "plan.proposed": [(p) => { queueMessage(Number(p.client_id), "meal_plan_ready", { week: String(p.week_start) }); return "plan_ready_message"; }],
  "order.created": [(p) => { queueMessage(Number(p.client_id), "order_confirmation", { order: String(p.order_number), total: String(p.total) }); return "order_confirmation"; }],
  "payment.reminder": [(p) => { queueMessage(Number(p.client_id), "payment_reminder", { order: String(p.order_number), total: String(p.total) }); return "payment_reminder"; }],
  "payment.received": [
    (p) => { notifyStaff(["admin", "kitchen", "accounting"], "Payment received", `Order ${p.order_number} is paid and has entered the production queue.`, `/orders/${p.order_id}`); return "production_queue"; },
  ],
  "production.started": [(p) => { queueMessage(Number(p.client_id), "preparation_started"); return "preparation_message"; }],
  "delivery.scheduled": [(p) => { queueMessage(Number(p.client_id), "delivery_reminder", { date: String(p.delivery_date), window: String(p.window) }); return "delivery_reminder"; }],
  "delivery.completed": [
    (p) => { queueMessage(Number(p.client_id), "delivered"); return "delivered_message"; },
    (p) => { queueMessage(Number(p.client_id), "feedback_request", { order: String(p.order_number) }); return "feedback_request"; },
  ],
  "inventory.low": [(p) => { notifyStaff(["admin", "kitchen"], "Low stock", `${p.ingredient} is below minimum stock (${p.stock} ${p.unit} left).`, "/inventory"); return "purchasing_alert"; }],
  "inventory.expiring": [(p) => { notifyStaff(["admin", "kitchen"], "Expiring stock", `${p.ingredient} lot ${p.batch} expires on ${p.expiry}.`, "/inventory"); return "expiry_alert"; }],
  "subscription.ending": [(p) => { queueMessage(Number(p.client_id), "subscription_renewal", { date: String(p.renewal_date) }); return "renewal_message"; }],
  "meal.cost_changed": [(p) => { notifyStaff(["admin", "accounting"], "Pricing review", `Cost of ${p.meal} changed to R${p.cost}; margin is now ${p.margin}%.`, `/meals/${p.meal_id}`); return "pricing_review_flag"; }],
  "feedback.received": [(p) => { if (Number(p.overall) <= 2) notifyStaff(["admin", "planner"], "Low rating", `A client rated a meal ${p.overall}/5.`, "/feedback"); return "low_rating_check"; }],
};

export function emit(type: EventType, payload: Record<string, unknown>): number {
  const db = getDb();
  const ran: string[] = [];
  for (const h of handlers[type] ?? []) {
    try { const r = h(payload); if (r) ran.push(r); } catch (e) { ran.push(`error:${(e as Error).message}`); }
  }
  const r = db.prepare("INSERT INTO automation_events (event_type, payload_json, handled_json) VALUES (?, ?, ?)")
    .run(type, JSON.stringify(payload), JSON.stringify(ran));
  const id = Number(r.lastInsertRowid);
  void sendWebhook(id, type, payload);
  return id;
}

async function sendWebhook(id: number, type: EventType, payload: Record<string, unknown>) {
  const url = process.env.MEALPREP_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mealprep-secret": process.env.MEALPREP_WEBHOOK_SECRET ?? "" },
      body: JSON.stringify({ id, type, payload, at: new Date().toISOString() }),
    });
    getDb().prepare("UPDATE automation_events SET webhook_status = ? WHERE id = ?").run(res.ok ? "sent" : "failed", id);
  } catch {
    getDb().prepare("UPDATE automation_events SET webhook_status = 'failed' WHERE id = ?").run(id);
  }
}

export function notifyStaff(roles: string[], title: string, body: string, link = "") {
  const db = getDb();
  const users = db.prepare(`SELECT id FROM users WHERE is_active = 1 AND role IN (${roles.map(() => "?").join(",")})`).all(...roles) as { id: number }[];
  const ins = db.prepare("INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)");
  for (const u of users) ins.run(u.id, title, body, link);
}

export function listEvents(limit = 100) {
  return getDb().prepare("SELECT * FROM automation_events ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number; event_type: string; payload_json: string; handled_json: string; webhook_status: string; created_at: string;
  }[];
}

export const AUTOMATION_CATALOGUE: { trigger: string; action: string; status: "live" | "integration" }[] = [
  { trigger: "New client completes onboarding", action: "Create profile, compute nutrition targets, flag professional review, send welcome message", status: "live" },
  { trigger: "Meal plan proposed", action: "Notify client that their plan is ready for approval", status: "live" },
  { trigger: "Meal plan approved", action: "Create order with one item per meal slot, snapshot cost & price", status: "live" },
  { trigger: "Order created", action: "Send order confirmation; grocery requirements update automatically", status: "live" },
  { trigger: "Order paid", action: "Move to production queue; create/merge production batches for the delivery date", status: "live" },
  { trigger: "Production started", action: "Notify client that preparation has started", status: "live" },
  { trigger: "Batch marked ready", action: "Generate labels with QR codes; create delivery record", status: "live" },
  { trigger: "Delivery completed", action: "Send 'delivered' message and feedback request", status: "live" },
  { trigger: "Stock below minimum", action: "Purchasing alert to kitchen & admin", status: "live" },
  { trigger: "Lot expiring within 3 days", action: "Expiry alert", status: "live" },
  { trigger: "Subscription renewal within 5 days", action: "Renewal notification", status: "live" },
  { trigger: "Ingredient price changed", action: "Meal cost recalculated (always derived); pricing review flag when margin drops below target", status: "live" },
  { trigger: "Recipe quantity changed", action: "Nutrition and cost recomputed on read", status: "live" },
  { trigger: "Any event", action: "POST to MEALPREP_WEBHOOK_URL (Make.com / Zapier / n8n / Google Sheets)", status: "integration" },
  { trigger: "Payment gateway webhook (PayFast / Stripe)", action: "Record payment → triggers 'order paid'", status: "integration" },
  { trigger: "WhatsApp / Email / SMS", action: "Queued messages are delivered by the channel adapter in lib/comms.ts", status: "integration" },
];

export function runScheduledChecks(): { low_stock: number; expiring: number; renewals: number } {
  const db = getDb();
  const low = db.prepare(
    `SELECT i.id, i.name, i.base_unit, i.min_stock, COALESCE(SUM(l.quantity_remaining),0) AS stock
       FROM ingredients i LEFT JOIN inventory_lots l ON l.ingredient_id = i.id
      WHERE i.is_active = 1 AND i.min_stock > 0 GROUP BY i.id HAVING stock < i.min_stock`
  ).all() as { id: number; name: string; base_unit: string; min_stock: number; stock: number }[];
  for (const i of low) if (!recentlyEmitted("inventory.low", i.id)) emit("inventory.low", { ingredient_id: i.id, ingredient: i.name, stock: i.stock, unit: i.base_unit });
  const expiring = db.prepare(
    `SELECT l.id, l.batch_number, l.expiry_date, i.name FROM inventory_lots l JOIN ingredients i ON i.id = l.ingredient_id
      WHERE l.quantity_remaining > 0 AND l.expiry_date IS NOT NULL AND l.expiry_date <= date('now', '+3 days')`
  ).all() as { id: number; batch_number: string; expiry_date: string; name: string }[];
  for (const l of expiring) if (!recentlyEmitted("inventory.expiring", l.id)) emit("inventory.expiring", { lot_id: l.id, ingredient: l.name, batch: l.batch_number, expiry: l.expiry_date });
  const renewals = db.prepare(
    `SELECT id, client_id, renewal_date FROM subscriptions WHERE status = 'active' AND renewal_date <= date('now', '+5 days')`
  ).all() as { id: number; client_id: number; renewal_date: string }[];
  for (const s of renewals) if (!recentlyEmitted("subscription.ending", s.id)) emit("subscription.ending", { subscription_id: s.id, client_id: s.client_id, renewal_date: s.renewal_date });
  return { low_stock: low.length, expiring: expiring.length, renewals: renewals.length };
}

function recentlyEmitted(type: EventType, id: number): boolean {
  const idKey = type === "inventory.low" ? "ingredient_id" : type === "inventory.expiring" ? "lot_id" : "subscription_id";
  const row = getDb().prepare(
    `SELECT COUNT(*) AS n FROM automation_events WHERE event_type = ? AND json_extract(payload_json, '$.${idKey}') = ? AND created_at > datetime('now', '-3 days')`
  ).get(type, id) as { n: number };
  return row.n > 0;
}

export type { TemplateKey };
