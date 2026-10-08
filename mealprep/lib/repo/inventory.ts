import { getDb } from "../db";
import type { InventoryLotRow, SupplierRow, SupplierProductRow, IngredientRow } from "../types";
import { audit } from "../audit";
import { emit } from "../automation";
import { mealsUsingIngredient, checkMargin } from "./meals";

export type StockLine = IngredientRow & { stock: number; lots: number; next_expiry: string | null; best_price: number | null; best_supplier: string | null; value: number };

export function stockOverview(): StockLine[] {
  return getDb().prepare(
    `SELECT i.*, COALESCE(SUM(l.quantity_remaining),0) AS stock, COUNT(l.id) AS lots,
            MIN(CASE WHEN l.quantity_remaining > 0 THEN l.expiry_date END) AS next_expiry,
            COALESCE(SUM(l.quantity_remaining * l.unit_cost),0) AS value,
            (SELECT MIN(sp.price_per_unit) FROM supplier_products sp WHERE sp.ingredient_id = i.id) AS best_price,
            (SELECT s.name FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.ingredient_id = i.id ORDER BY sp.price_per_unit LIMIT 1) AS best_supplier
       FROM ingredients i LEFT JOIN inventory_lots l ON l.ingredient_id = i.id
      WHERE i.is_active = 1 GROUP BY i.id ORDER BY i.category, i.name`
  ).all() as StockLine[];
}

export function lotsFor(ingredientId: number): InventoryLotRow[] {
  return getDb().prepare("SELECT * FROM inventory_lots WHERE ingredient_id = ? AND quantity_remaining > 0 ORDER BY COALESCE(expiry_date, '9999'), received_at").all(ingredientId) as InventoryLotRow[];
}

export function allLots(): (InventoryLotRow & { ingredient: string; unit: string; supplier: string | null })[] {
  return getDb().prepare(
    `SELECT l.*, i.name AS ingredient, i.base_unit AS unit, s.name AS supplier FROM inventory_lots l JOIN ingredients i ON i.id = l.ingredient_id LEFT JOIN suppliers s ON s.id = l.supplier_id
      WHERE l.quantity_remaining > 0 ORDER BY COALESCE(l.expiry_date, '9999'), l.received_at`
  ).all() as (InventoryLotRow & { ingredient: string; unit: string; supplier: string | null })[];
}

export function receiveLot(l: { ingredient_id: number; supplier_id: number | null; purchase_order_id?: number | null; batch_number: string; quantity: number; unit_cost: number; expiry_date: string | null; storage_location: string }, userId: number | null): number {
  const db = getDb();
  const r = db.prepare(
    "INSERT INTO inventory_lots (ingredient_id, supplier_id, purchase_order_id, batch_number, quantity_received, quantity_remaining, unit_cost, expiry_date, storage_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(l.ingredient_id, l.supplier_id, l.purchase_order_id ?? null, l.batch_number, l.quantity, l.quantity, l.unit_cost, l.expiry_date, l.storage_location);
  const lotId = Number(r.lastInsertRowid);
  db.prepare("INSERT INTO inventory_transactions (lot_id, ingredient_id, type, quantity, reason, reference_type, user_id) VALUES (?, ?, 'purchase', ?, ?, 'manual', ?)")
    .run(lotId, l.ingredient_id, l.quantity, l.batch_number, userId);
  db.prepare("INSERT INTO expenses (category, description, amount_zar, incurred_at, supplier_id) VALUES ('food', ?, ?, date('now'), ?)")
    .run(`Stock received: ${l.batch_number || "lot " + lotId}`, Math.round(l.quantity * l.unit_cost * 100) / 100, l.supplier_id);
  audit(userId, "receive", "inventory_lot", lotId, `${l.quantity} @ ${l.unit_cost}`);
  return lotId;
}

/** FIFO (by expiry, then receipt) consumption. Returns the quantity actually consumed and its cost. */
export function consumeFifo(ingredientId: number, qty: number, ref: { type: string; id: number | null }, userId: number | null): { consumed: number; cost: number; shortfall: number } {
  const db = getDb();
  let remaining = qty;
  let cost = 0;
  const upd = db.prepare("UPDATE inventory_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?");
  const ins = db.prepare("INSERT INTO inventory_transactions (lot_id, ingredient_id, type, quantity, reason, reference_type, reference_id, user_id) VALUES (?, ?, 'consume', ?, '', ?, ?, ?)");
  for (const lot of lotsFor(ingredientId)) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity_remaining, remaining);
    upd.run(take, lot.id);
    ins.run(lot.id, ingredientId, -take, ref.type, ref.id, userId);
    cost += take * lot.unit_cost;
    remaining -= take;
  }
  const ing = db.prepare("SELECT name, base_unit, min_stock FROM ingredients WHERE id = ?").get(ingredientId) as { name: string; base_unit: string; min_stock: number };
  const stock = (db.prepare("SELECT COALESCE(SUM(quantity_remaining),0) AS s FROM inventory_lots WHERE ingredient_id = ?").get(ingredientId) as { s: number }).s;
  if (ing.min_stock > 0 && stock < ing.min_stock) emit("inventory.low", { ingredient_id: ingredientId, ingredient: ing.name, stock, unit: ing.base_unit });
  return { consumed: qty - remaining, cost, shortfall: remaining };
}

export function recordWaste(lotId: number, qty: number, reason: string, userId: number | null) {
  const db = getDb();
  const lot = db.prepare("SELECT * FROM inventory_lots WHERE id = ?").get(lotId) as InventoryLotRow | undefined;
  if (!lot) throw new Error("Lot not found");
  const take = Math.min(qty, lot.quantity_remaining);
  db.prepare("UPDATE inventory_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?").run(take, lotId);
  db.prepare("INSERT INTO inventory_transactions (lot_id, ingredient_id, type, quantity, reason, reference_type, user_id) VALUES (?, ?, 'waste', ?, ?, 'manual', ?)")
    .run(lotId, lot.ingredient_id, -take, reason, userId);
  audit(userId, "waste", "inventory_lot", lotId, `${take} ${reason}`);
}

export function adjustStock(lotId: number, newQty: number, reason: string, userId: number | null) {
  const db = getDb();
  const lot = db.prepare("SELECT * FROM inventory_lots WHERE id = ?").get(lotId) as InventoryLotRow | undefined;
  if (!lot) throw new Error("Lot not found");
  const delta = newQty - lot.quantity_remaining;
  db.prepare("UPDATE inventory_lots SET quantity_remaining = ? WHERE id = ?").run(newQty, lotId);
  db.prepare("INSERT INTO inventory_transactions (lot_id, ingredient_id, type, quantity, reason, reference_type, user_id) VALUES (?, ?, 'adjust', ?, ?, 'manual', ?)").run(lotId, lot.ingredient_id, delta, reason, userId);
  audit(userId, "adjust", "inventory_lot", lotId, `${delta} ${reason}`);
}

export function inventoryAlerts() {
  const db = getDb();
  const low = stockOverview().filter((s) => s.min_stock > 0 && s.stock < s.min_stock);
  const expiring = db.prepare(
    `SELECT l.*, i.name AS ingredient, i.base_unit AS unit FROM inventory_lots l JOIN ingredients i ON i.id = l.ingredient_id
      WHERE l.quantity_remaining > 0 AND l.expiry_date IS NOT NULL AND l.expiry_date <= date('now', '+3 days') ORDER BY l.expiry_date`
  ).all() as (InventoryLotRow & { ingredient: string; unit: string })[];
  return { low, expiring };
}

export function wasteSummary(days = 30) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT i.name, i.base_unit, -SUM(t.quantity) AS qty, -SUM(t.quantity * COALESCE(l.unit_cost, i.default_cost_per_unit)) AS value, COUNT(*) AS events
       FROM inventory_transactions t JOIN ingredients i ON i.id = t.ingredient_id LEFT JOIN inventory_lots l ON l.id = t.lot_id
      WHERE t.type = 'waste' AND t.created_at >= date('now', ?) GROUP BY i.id ORDER BY value DESC`
  ).all(`-${days} days`) as { name: string; base_unit: string; qty: number; value: number; events: number }[];
  const production = db.prepare("SELECT COALESCE(SUM(quantity_wasted),0) AS meals, COALESCE(SUM(quantity_done),0) AS done FROM production_batches WHERE production_date >= date('now', ?)").get(`-${days} days`) as { meals: number; done: number };
  return { ingredients: rows, total_value: rows.reduce((s, r) => s + r.value, 0), meals_wasted: production.meals, meals_done: production.done };
}

export function transactions(limit = 200) {
  return getDb().prepare(
    `SELECT t.*, i.name AS ingredient, i.base_unit AS unit, u.name AS user FROM inventory_transactions t JOIN ingredients i ON i.id = t.ingredient_id LEFT JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT ?`
  ).all(limit) as { id: number; type: string; quantity: number; reason: string; reference_type: string; reference_id: number | null; created_at: string; ingredient: string; unit: string; user: string | null }[];
}

// ------------------------------------------------------------- suppliers
export function listSuppliers(): (SupplierRow & { products: number })[] {
  return getDb().prepare("SELECT s.*, (SELECT COUNT(*) FROM supplier_products sp WHERE sp.supplier_id = s.id) AS products FROM suppliers s ORDER BY s.is_active DESC, s.name").all() as (SupplierRow & { products: number })[];
}

export function getSupplier(id: number) {
  const db = getDb();
  const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id) as SupplierRow | undefined;
  if (!supplier) return null;
  const products = db.prepare("SELECT sp.*, i.name AS ingredient, i.base_unit AS unit FROM supplier_products sp JOIN ingredients i ON i.id = sp.ingredient_id WHERE sp.supplier_id = ? ORDER BY i.name").all(id) as (SupplierProductRow & { ingredient: string; unit: string })[];
  const purchases = db.prepare("SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 20").all(id) as { id: number; status: string; total_zar: number; created_at: string; received_at: string | null }[];
  return { supplier, products, purchases };
}

export function upsertSupplier(data: Partial<SupplierRow> & { id?: number }, userId: number | null): number {
  const db = getDb();
  const cols = ["name", "contact_name", "phone", "email", "min_order_zar", "delivery_days", "lead_time_days", "reliability", "quality", "notes", "is_active"] as const;
  const present = cols.filter((c) => data[c] !== undefined);
  if (data.id) {
    db.prepare(`UPDATE suppliers SET ${present.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...present.map((c) => data[c] as unknown), data.id);
    audit(userId, "update", "supplier", data.id, "");
    return data.id;
  }
  const r = db.prepare(`INSERT INTO suppliers (${present.join(", ")}) VALUES (${present.map(() => "?").join(", ")})`).run(...present.map((c) => data[c] as unknown));
  audit(userId, "create", "supplier", Number(r.lastInsertRowid), data.name ?? "");
  return Number(r.lastInsertRowid);
}

export function setSupplierPrice(supplierId: number, ingredientId: number, price: number, packSize: number, userId: number | null) {
  const db = getDb();
  const existing = db.prepare("SELECT id, price_per_unit FROM supplier_products WHERE supplier_id = ? AND ingredient_id = ?").get(supplierId, ingredientId) as { id: number; price_per_unit: number } | undefined;
  let id: number;
  if (existing) {
    db.prepare("UPDATE supplier_products SET price_per_unit = ?, pack_size = ?, updated_at = datetime('now') WHERE id = ?").run(price, packSize, existing.id);
    id = existing.id;
  } else {
    id = Number(db.prepare("INSERT INTO supplier_products (supplier_id, ingredient_id, price_per_unit, pack_size) VALUES (?, ?, ?, ?)").run(supplierId, ingredientId, price, packSize).lastInsertRowid);
  }
  db.prepare("INSERT INTO supplier_price_history (supplier_product_id, price_per_unit) VALUES (?, ?)").run(id, price);
  audit(userId, "price", "supplier_product", id, `${price}`);
  // Ingredient price changed → meal costs are derived, so only the margin flag needs checking.
  for (const m of mealsUsingIngredient(ingredientId)) checkMargin(m);
}

export type SupplierOption = { supplier_id: number; supplier: string; price_per_unit: number; pack_size: number; reliability: number; quality: number; lead_time_days: number; min_order_zar: number; score: number; recommended: boolean };

/** Compare suppliers for an ingredient. Score blends price (60 %), reliability (25 %) and quality (15 %). */
export function compareSuppliers(ingredientId: number): SupplierOption[] {
  const rows = getDb().prepare(
    `SELECT s.id AS supplier_id, s.name AS supplier, sp.price_per_unit, sp.pack_size, s.reliability, s.quality, s.lead_time_days, s.min_order_zar
       FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.ingredient_id = ? AND s.is_active = 1 ORDER BY sp.price_per_unit`
  ).all(ingredientId) as Omit<SupplierOption, "score" | "recommended">[];
  if (!rows.length) return [];
  const min = rows[0].price_per_unit;
  const scored = rows.map((r) => {
    const priceScore = min / r.price_per_unit; // 1 for cheapest
    const score = Math.round((priceScore * 0.6 + (r.reliability / 5) * 0.25 + (r.quality / 5) * 0.15) * 100);
    return { ...r, score, recommended: false };
  }).sort((a, b) => b.score - a.score);
  scored[0].recommended = true;
  return scored;
}

export function priceComparisonTable(): { ingredient_id: number; ingredient: string; unit: string; options: SupplierOption[] }[] {
  const ings = getDb().prepare("SELECT DISTINCT i.id, i.name, i.base_unit FROM ingredients i JOIN supplier_products sp ON sp.ingredient_id = i.id ORDER BY i.name").all() as { id: number; name: string; base_unit: string }[];
  return ings.map((i) => ({ ingredient_id: i.id, ingredient: i.name, unit: i.base_unit, options: compareSuppliers(i.id) }));
}

export function createPurchaseOrder(supplierId: number, lines: { ingredient_id: number; quantity: number; price_per_unit: number }[], userId: number | null): number {
  const db = getDb();
  const total = lines.reduce((s, l) => s + l.quantity * l.price_per_unit, 0);
  const id = Number(db.prepare("INSERT INTO purchase_orders (supplier_id, status, total_zar, expected_at) VALUES (?, 'sent', ?, date('now', '+' || (SELECT lead_time_days FROM suppliers WHERE id = ?) || ' days'))").run(supplierId, Math.round(total * 100) / 100, supplierId).lastInsertRowid);
  const ins = db.prepare("INSERT INTO purchase_order_lines (purchase_order_id, ingredient_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
  for (const l of lines) ins.run(id, l.ingredient_id, l.quantity, l.price_per_unit);
  audit(userId, "create", "purchase_order", id, `R${total.toFixed(2)}`);
  return id;
}

export function receivePurchaseOrder(poId: number, userId: number | null) {
  const db = getDb();
  const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(poId) as { id: number; supplier_id: number; status: string } | undefined;
  if (!po || po.status === "received") return;
  const lines = db.prepare("SELECT * FROM purchase_order_lines WHERE purchase_order_id = ?").all(poId) as { ingredient_id: number; quantity: number; price_per_unit: number }[];
  db.transaction(() => {
    for (const l of lines) {
      const ing = db.prepare("SELECT storage FROM ingredients WHERE id = ?").get(l.ingredient_id) as { storage: string };
      const expiryDays = ing.storage === "frozen" ? 90 : ing.storage === "ambient" ? 180 : 5;
      receiveLot({ ingredient_id: l.ingredient_id, supplier_id: po.supplier_id, purchase_order_id: poId, batch_number: `PO${poId}-${l.ingredient_id}`, quantity: l.quantity, unit_cost: l.price_per_unit, expiry_date: addDays(new Date(), expiryDays), storage_location: ing.storage === "frozen" ? "Freezer" : ing.storage === "ambient" ? "Dry store" : "Walk-in fridge" }, userId);
    }
    db.prepare("UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?").run(poId);
  })();
}

export function listPurchaseOrders() {
  return getDb().prepare("SELECT po.*, s.name AS supplier, (SELECT COUNT(*) FROM purchase_order_lines l WHERE l.purchase_order_id = po.id) AS lines FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC").all() as { id: number; supplier_id: number; supplier: string; status: string; total_zar: number; expected_at: string | null; received_at: string | null; created_at: string; lines: number }[];
}

export function addDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}
