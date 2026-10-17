import { getDb } from "../db";
import type { ProductionBatchRow, ProductionStatus, DeliveryRow, DeliveryStatus } from "../types";
import { PRODUCTION_STATUSES } from "../types";
import { audit } from "../audit";
import { emit } from "../automation";
import { consumeFifo } from "./inventory";
import crypto from "crypto";

/**
 * Kitchen production: one batch per (date, meal). Batches are created when an
 * order is paid, grow as more paid orders land, consume inventory (FIFO) when
 * cooking starts, and generate labels + delivery records when ready.
 */

export function ensureBatchesForOrder(orderId: number, userId: number | null) {
  const db = getDb();
  const order = db.prepare("SELECT id, delivery_date, location_id FROM orders WHERE id = ?").get(orderId) as { id: number; delivery_date: string; location_id: number | null } | undefined;
  if (!order) return;
  // Production happens the day before delivery.
  const prodDate = addDays(order.delivery_date, -1);
  const items = db.prepare("SELECT id, meal_id, quantity FROM order_items WHERE order_id = ?").all(orderId) as { id: number; meal_id: number; quantity: number }[];
  db.transaction(() => {
    for (const it of items) {
      const linked = db.prepare("SELECT 1 FROM production_items WHERE order_item_id = ?").get(it.id);
      if (linked) continue;
      let batch = db.prepare("SELECT id FROM production_batches WHERE production_date = ? AND meal_id = ?").get(prodDate, it.meal_id) as { id: number } | undefined;
      if (!batch) {
        const r = db.prepare("INSERT INTO production_batches (production_date, meal_id, location_id, quantity_required) VALUES (?, ?, ?, 0)").run(prodDate, it.meal_id, order.location_id);
        batch = { id: Number(r.lastInsertRowid) };
      }
      db.prepare("UPDATE production_batches SET quantity_required = quantity_required + ? WHERE id = ?").run(it.quantity, batch.id);
      db.prepare("INSERT INTO production_items (batch_id, order_item_id) VALUES (?, ?)").run(batch.id, it.id);
      db.prepare("UPDATE order_items SET status = 'in_production' WHERE id = ?").run(it.id);
    }
    db.prepare("UPDATE orders SET status = CASE WHEN status = 'paid' THEN 'plan_created' ELSE status END WHERE id = ?").run(orderId);
  })();
  audit(userId, "queue", "order", orderId, `production ${prodDate}`);
}

export type BatchView = ProductionBatchRow & { meal_name: string; category: string; assigned_name: string | null; orders: number; clients: string };

export function batchesForDate(date: string): BatchView[] {
  return getDb().prepare(
    `SELECT b.*, m.name AS meal_name, m.category, u.name AS assigned_name,
            (SELECT COUNT(DISTINCT oi.order_id) FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id WHERE pi.batch_id = b.id) AS orders,
            (SELECT GROUP_CONCAT(DISTINCT c.first_name || ' ' || substr(c.last_name,1,1) || '.') FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id JOIN orders o ON o.id = oi.order_id JOIN clients c ON c.id = o.client_id WHERE pi.batch_id = b.id) AS clients
       FROM production_batches b JOIN meals m ON m.id = b.meal_id LEFT JOIN users u ON u.id = b.assigned_user_id
      WHERE b.production_date = ? ORDER BY m.category, m.name`
  ).all(date) as BatchView[];
}

export function batchesBetween(from: string, to: string): BatchView[] {
  return getDb().prepare(
    `SELECT b.*, m.name AS meal_name, m.category, u.name AS assigned_name, 0 AS orders, '' AS clients
       FROM production_batches b JOIN meals m ON m.id = b.meal_id LEFT JOIN users u ON u.id = b.assigned_user_id
      WHERE b.production_date BETWEEN ? AND ? ORDER BY b.production_date, m.category, m.name`
  ).all(from, to) as BatchView[];
}

/** Ingredients a batch needs (scaled from the recipe to the batch quantity). */
export function batchIngredients(batchId: number) {
  const db = getDb();
  const b = db.prepare("SELECT b.*, m.servings FROM production_batches b JOIN meals m ON m.id = b.meal_id WHERE b.id = ?").get(batchId) as (ProductionBatchRow & { servings: number }) | undefined;
  if (!b) return [];
  const mult = (db.prepare("SELECT AVG(oi.portion_multiplier) AS m FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id WHERE pi.batch_id = ?").get(batchId) as { m: number | null }).m ?? 1;
  const factor = (b.quantity_required * mult) / Math.max(1, b.servings);
  return (db.prepare("SELECT ri.ingredient_id, ri.quantity, i.name, i.base_unit, (SELECT COALESCE(SUM(quantity_remaining),0) FROM inventory_lots l WHERE l.ingredient_id = i.id) AS stock FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.meal_id = ? ORDER BY ri.sort_order").all(b.meal_id) as { ingredient_id: number; quantity: number; name: string; base_unit: string; stock: number }[])
    .map((r) => ({ ...r, required: Math.round(r.quantity * factor * 100) / 100 }));
}

export function setBatchStatus(batchId: number, status: ProductionStatus, userId: number | null, opts: { quantity_done?: number; quantity_wasted?: number; qc_notes?: string; assigned_user_id?: number | null } = {}) {
  const db = getDb();
  const b = db.prepare("SELECT * FROM production_batches WHERE id = ?").get(batchId) as ProductionBatchRow | undefined;
  if (!b) return;
  const idx = PRODUCTION_STATUSES.indexOf(status);
  const prevIdx = PRODUCTION_STATUSES.indexOf(b.status);
  db.transaction(() => {
    db.prepare("UPDATE production_batches SET status = ?, started_at = COALESCE(started_at, CASE WHEN ? > 0 THEN datetime('now') END), completed_at = CASE WHEN ? >= 6 THEN COALESCE(completed_at, datetime('now')) ELSE completed_at END, quantity_done = COALESCE(?, quantity_done), quantity_wasted = COALESCE(?, quantity_wasted), qc_notes = COALESCE(?, qc_notes), assigned_user_id = COALESCE(?, assigned_user_id) WHERE id = ?")
      .run(status, idx, idx, opts.quantity_done ?? null, opts.quantity_wasted ?? null, opts.qc_notes ?? null, opts.assigned_user_id ?? null, batchId);
    // Entering "cooking" consumes ingredients (FIFO) once.
    if (status === "cooking" && prevIdx < PRODUCTION_STATUSES.indexOf("cooking")) {
      for (const ing of batchIngredients(batchId)) consumeFifo(ing.ingredient_id, ing.required, { type: "production_batch", id: batchId }, userId);
    }
    if (status === "ready") {
      db.prepare("UPDATE production_batches SET quantity_done = CASE WHEN quantity_done = 0 THEN quantity_required ELSE quantity_done END WHERE id = ?").run(batchId);
      db.prepare("UPDATE order_items SET status = 'ready' WHERE id IN (SELECT order_item_id FROM production_items WHERE batch_id = ?)").run(batchId);
      ensureLabelsForBatch(batchId);
    }
    if (status === "packaging") db.prepare("UPDATE order_items SET status = 'packed' WHERE id IN (SELECT order_item_id FROM production_items WHERE batch_id = ?)").run(batchId);
    // Order status follows the least-advanced batch it depends on.
    const orderIds = (db.prepare("SELECT DISTINCT oi.order_id FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id WHERE pi.batch_id = ?").all(batchId) as { order_id: number }[]).map((r) => r.order_id);
    for (const oid of orderIds) syncOrderStatusFromBatches(oid, userId);
  })();
  audit(userId, "status", "production_batch", batchId, status);
}

function syncOrderStatusFromBatches(orderId: number, userId: number | null) {
  const db = getDb();
  const rows = db.prepare("SELECT b.status FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id JOIN production_batches b ON b.id = pi.batch_id WHERE oi.order_id = ?").all(orderId) as { status: ProductionStatus }[];
  if (!rows.length) return;
  const min = Math.min(...rows.map((r) => PRODUCTION_STATUSES.indexOf(r.status)));
  const cur = (db.prepare("SELECT status, client_id FROM orders WHERE id = ?").get(orderId) as { status: string; client_id: number });
  if (["out_for_delivery", "delivered", "completed", "cancelled"].includes(cur.status)) return;
  let next = cur.status;
  if (min >= PRODUCTION_STATUSES.indexOf("ready")) next = "ready";
  else if (min >= PRODUCTION_STATUSES.indexOf("packaging")) next = "packaging";
  else if (min >= PRODUCTION_STATUSES.indexOf("preparing")) next = "preparing";
  if (next !== cur.status) {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(next, orderId);
    if (next === "preparing") emit("production.started", { order_id: orderId, client_id: cur.client_id });
    if (next === "ready") emit("order.ready", { order_id: orderId, client_id: cur.client_id });
    audit(userId, "status", "order", orderId, `${next} (from production)`);
  }
}

export function productionSummary(date: string) {
  const batches = batchesForDate(date);
  const required = batches.reduce((s, b) => s + b.quantity_required, 0);
  const ready = batches.filter((b) => ["ready", "delivered"].includes(b.status)).reduce((s, b) => s + b.quantity_required, 0);
  const inProgress = batches.filter((b) => !["not_started", "ready", "delivered"].includes(b.status)).reduce((s, b) => s + b.quantity_required, 0);
  return { batches, required, ready, in_progress: inProgress, remaining: required - ready };
}

// ------------------------------------------------------------- labels
export function ensureLabelsForBatch(batchId: number) {
  const db = getDb();
  const items = db.prepare("SELECT oi.id, m.shelf_life_days FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id JOIN meals m ON m.id = oi.meal_id WHERE pi.batch_id = ?").all(batchId) as { id: number; shelf_life_days: number }[];
  const b = db.prepare("SELECT production_date FROM production_batches WHERE id = ?").get(batchId) as { production_date: string };
  for (const it of items) ensureLabel(it.id, b.production_date, it.shelf_life_days);
}

export function ensureLabel(orderItemId: number, preparedOn: string, shelfLifeDays: number): string {
  const db = getDb();
  const existing = db.prepare("SELECT token FROM meal_labels WHERE order_item_id = ?").get(orderItemId) as { token: string } | undefined;
  if (existing) return existing.token;
  const token = crypto.randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO meal_labels (order_item_id, token, prepared_on, best_before) VALUES (?, ?, ?, ?)").run(orderItemId, token, preparedOn, addDays(preparedOn, shelfLifeDays));
  return token;
}

export function labelsForOrder(orderId: number) {
  const db = getDb();
  const order = db.prepare("SELECT o.*, c.first_name || ' ' || c.last_name AS client_name FROM orders o JOIN clients c ON c.id = o.client_id WHERE o.id = ?").get(orderId) as { id: number; order_number: string; client_id: number; client_name: string; delivery_date: string } | undefined;
  if (!order) return null;
  const items = db.prepare("SELECT oi.*, m.shelf_life_days FROM order_items oi JOIN meals m ON m.id = oi.meal_id WHERE oi.order_id = ? ORDER BY oi.meal_number").all(orderId) as { id: number; meal_id: number; meal_number: number; quantity: number; portion_multiplier: number; shelf_life_days: number }[];
  const prepared = addDays(order.delivery_date, -1);
  const total = items.length;
  return items.map((it) => ({ ...it, total, token: ensureLabel(it.id, prepared, it.shelf_life_days), client_name: order.client_name, order_number: order.order_number, prepared_on: prepared, best_before: addDays(prepared, it.shelf_life_days) }));
}

export function markLabelsPrinted(orderId: number) {
  getDb().prepare("UPDATE meal_labels SET printed_at = datetime('now') WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)").run(orderId);
}

export function labelByToken(token: string) {
  const db = getDb();
  return (db.prepare(
    `SELECT l.*, oi.meal_id, oi.meal_number, oi.portion_multiplier, oi.order_id, o.client_id, o.order_number, c.first_name,
            (SELECT COUNT(*) FROM order_items x WHERE x.order_id = oi.order_id) AS total
       FROM meal_labels l JOIN order_items oi ON oi.id = l.order_item_id JOIN orders o ON o.id = oi.order_id JOIN clients c ON c.id = o.client_id WHERE l.token = ?`
  ).get(token) as { id: number; token: string; prepared_on: string; best_before: string; meal_id: number; meal_number: number; portion_multiplier: number; order_id: number; client_id: number; order_number: string; first_name: string; total: number } | undefined) ?? null;
}

// ------------------------------------------------------------- deliveries
export function ensureDeliveryForOrder(orderId: number, userId: number | null): number {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM deliveries WHERE order_id = ?").get(orderId) as { id: number } | undefined;
  if (existing) return existing.id;
  const o = db.prepare("SELECT id, client_id, delivery_date, delivery_address FROM orders WHERE id = ?").get(orderId) as { id: number; client_id: number; delivery_date: string; delivery_address: string };
  const r = db.prepare("INSERT INTO deliveries (order_id, client_id, delivery_date, address, status) VALUES (?, ?, ?, ?, 'pending')").run(orderId, o.client_id, o.delivery_date, o.delivery_address);
  const id = Number(r.lastInsertRowid);
  audit(userId, "create", "delivery", id, o.delivery_date);
  emit("delivery.scheduled", { delivery_id: id, order_id: orderId, client_id: o.client_id, delivery_date: o.delivery_date, window: "08:00–12:00" });
  return id;
}

export type DeliveryView = DeliveryRow & { client_name: string; phone: string; order_number: string; driver_name: string | null; meals: number; delivery_notes: string };

export function deliveriesForDate(date: string): DeliveryView[] {
  return getDb().prepare(
    `SELECT d.*, c.first_name || ' ' || c.last_name AS client_name, c.phone, c.delivery_notes, o.order_number, u.name AS driver_name,
            (SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = d.order_id) AS meals
       FROM deliveries d JOIN clients c ON c.id = d.client_id JOIN orders o ON o.id = d.order_id LEFT JOIN users u ON u.id = d.driver_id
      WHERE d.delivery_date = ? ORDER BY d.route_id, d.sequence, d.window_start`
  ).all(date) as DeliveryView[];
}

export function upcomingDeliveries(days = 7): DeliveryView[] {
  return getDb().prepare(
    `SELECT d.*, c.first_name || ' ' || c.last_name AS client_name, c.phone, c.delivery_notes, o.order_number, u.name AS driver_name,
            (SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = d.order_id) AS meals
       FROM deliveries d JOIN clients c ON c.id = d.client_id JOIN orders o ON o.id = d.order_id LEFT JOIN users u ON u.id = d.driver_id
      WHERE d.delivery_date BETWEEN date('now') AND date('now', ?) AND d.status != 'delivered' ORDER BY d.delivery_date, d.window_start`
  ).all(`+${days} days`) as DeliveryView[];
}

export function assignDriver(deliveryId: number, driverId: number | null, windowStart: string, windowEnd: string, userId: number | null) {
  getDb().prepare("UPDATE deliveries SET driver_id = ?, window_start = ?, window_end = ?, status = CASE WHEN ? IS NULL THEN 'pending' WHEN status = 'pending' THEN 'assigned' ELSE status END WHERE id = ?").run(driverId, windowStart, windowEnd, driverId, deliveryId);
  audit(userId, "assign", "delivery", deliveryId, `driver ${driverId ?? "none"}`);
}

export function setDeliveryStatus(deliveryId: number, status: DeliveryStatus, userId: number | null, proof: { type?: string; note?: string; failure_reason?: string } = {}) {
  const db = getDb();
  const d = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(deliveryId) as DeliveryRow | undefined;
  if (!d) return;
  db.prepare("UPDATE deliveries SET status = ?, proof_type = COALESCE(?, proof_type), proof_note = COALESCE(?, proof_note), failure_reason = COALESCE(?, failure_reason), delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END WHERE id = ?")
    .run(status, proof.type ?? null, proof.note ?? null, proof.failure_reason ?? null, status, deliveryId);
  const orderStatus = status === "out_for_delivery" ? "out_for_delivery" : status === "delivered" ? "delivered" : null;
  if (orderStatus) {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(orderStatus, d.order_id);
    if (status === "delivered") {
      db.prepare("UPDATE order_items SET status = 'delivered' WHERE order_id = ?").run(d.order_id);
      db.prepare("UPDATE production_batches SET status = 'delivered' WHERE id IN (SELECT pi.batch_id FROM production_items pi JOIN order_items oi ON oi.id = pi.order_item_id WHERE oi.order_id = ?) AND NOT EXISTS (SELECT 1 FROM production_items pi2 JOIN order_items oi2 ON oi2.id = pi2.order_item_id WHERE pi2.batch_id = production_batches.id AND oi2.status != 'delivered')").run(d.order_id);
      const o = db.prepare("SELECT order_number FROM orders WHERE id = ?").get(d.order_id) as { order_number: string };
      emit("delivery.completed", { delivery_id: deliveryId, order_id: d.order_id, client_id: d.client_id, order_number: o.order_number });
    }
  }
  audit(userId, "status", "delivery", deliveryId, status);
}

/** Build (or rebuild) today's route for a driver: orders sorted by window then suburb text. */
export function buildRoute(date: string, driverId: number | null, userId: number | null): number {
  const db = getDb();
  let route = db.prepare("SELECT id FROM delivery_routes WHERE route_date = ? AND COALESCE(driver_id, 0) = COALESCE(?, 0)").get(date, driverId) as { id: number } | undefined;
  if (!route) {
    const r = db.prepare("INSERT INTO delivery_routes (route_date, driver_id, name) VALUES (?, ?, ?)").run(date, driverId, `Route ${date}`);
    route = { id: Number(r.lastInsertRowid) };
  }
  const stops = db.prepare("SELECT id, address, window_start FROM deliveries WHERE delivery_date = ? AND (driver_id = ? OR (? IS NULL AND driver_id IS NULL)) AND status != 'delivered' ORDER BY window_start, address").all(date, driverId, driverId) as { id: number; address: string; window_start: string }[];
  // Simple heuristic: group by the last address token (suburb/city) to reduce zig-zag; a maps API can replace this.
  stops.sort((a, b) => a.window_start.localeCompare(b.window_start) || suburb(a.address).localeCompare(suburb(b.address)));
  const upd = db.prepare("UPDATE deliveries SET route_id = ?, sequence = ? WHERE id = ?");
  stops.forEach((s, i) => upd.run(route!.id, i + 1, s.id));
  audit(userId, "route", "delivery_route", route.id, `${stops.length} stops`);
  return route.id;
}

function suburb(address: string): string {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? "";
}

export function drivers() {
  return getDb().prepare("SELECT id, name FROM users WHERE role IN ('delivery','admin') AND is_active = 1 ORDER BY name").all() as { id: number; name: string }[];
}

export function kitchenStaff() {
  return getDb().prepare("SELECT id, name FROM users WHERE role IN ('kitchen','packaging','admin') AND is_active = 1 ORDER BY name").all() as { id: number; name: string }[];
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
