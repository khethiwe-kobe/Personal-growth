import { getDb } from "../db";
import type {
  ClientRow, HealthProfileRow, PreferencesRow, AllergyRow, GoalRow, TargetsRow, ProgressRow,
} from "../types";
import { parseJson } from "../types";
import { computeTargets, profileInputFromRows, type NutritionTargets } from "../nutrition";
import { audit } from "../audit";
import { emit } from "../automation";
import { hashPassword } from "../auth";

export type ClientFull = {
  client: ClientRow;
  health: HealthProfileRow | null;
  prefs: PreferencesRow | null;
  allergies: AllergyRow[];
  goals: GoalRow[];
  targets: TargetsRow | null;
  computed: NutritionTargets;
  reviews: { id: number; reviewer_name: string; reviewer_role: string; outcome: string; notes: string; reviewed_at: string | null; created_at: string }[];
};

export function listClients(opts: { status?: string; q?: string } = {}): (ClientRow & { orders: number; last_order: string | null; review_flag: number })[] {
  const db = getDb();
  const where: string[] = ["c.anonymised_at IS NULL"];
  const params: unknown[] = [];
  if (opts.status) { where.push("c.status = ?"); params.push(opts.status); }
  if (opts.q) { where.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)"); params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`); }
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id AND o.status != 'cancelled') AS orders,
              (SELECT MAX(o.delivery_date) FROM orders o WHERE o.client_id = c.id) AS last_order,
              COALESCE((SELECT t.requires_professional_review FROM client_nutrition_targets t WHERE t.client_id = c.id), 0) AS review_flag
         FROM clients c WHERE ${where.join(" AND ")} ORDER BY c.registered_at DESC`
    )
    .all(...params) as (ClientRow & { orders: number; last_order: string | null; review_flag: number })[];
}

export function getClient(id: number): ClientRow | null {
  return (getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as ClientRow | undefined) ?? null;
}

export function getClientFull(id: number): ClientFull | null {
  const db = getDb();
  const client = getClient(id);
  if (!client) return null;
  const health = (db.prepare("SELECT * FROM client_health_profiles WHERE client_id = ?").get(id) as HealthProfileRow | undefined) ?? null;
  const prefs = (db.prepare("SELECT * FROM client_preferences WHERE client_id = ?").get(id) as PreferencesRow | undefined) ?? null;
  const allergies = db.prepare("SELECT * FROM client_allergies WHERE client_id = ? ORDER BY kind, allergen").all(id) as AllergyRow[];
  const goals = db.prepare("SELECT * FROM client_goals WHERE client_id = ? ORDER BY is_primary DESC, created_at").all(id) as GoalRow[];
  const targets = (db.prepare("SELECT * FROM client_nutrition_targets WHERE client_id = ?").get(id) as TargetsRow | undefined) ?? null;
  const reviews = db.prepare("SELECT * FROM professional_reviews WHERE client_id = ? ORDER BY created_at DESC").all(id) as ClientFull["reviews"];
  const primaryGoal = goals.find((g) => g.is_primary)?.goal_type ?? goals[0]?.goal_type ?? "balanced";
  const computed = computeTargets(profileInputFromRows(client, health, primaryGoal, allergies, prefs?.meals_per_day ?? 3, !!(prefs?.include_snacks ?? 1)));
  return { client, health, prefs, allergies, goals, targets, computed, reviews };
}

export function recomputeTargets(clientId: number): NutritionTargets {
  const full = getClientFull(clientId);
  if (!full) throw new Error("Client not found");
  const t = full.computed;
  getDb()
    .prepare(
      `INSERT INTO client_nutrition_targets (client_id, bmr, tdee, calories_min, calories_target, calories_max, protein_g, carbs_min_g, carbs_max_g,
         fat_min_g, fat_max_g, fibre_g, water_ml, method, flags_json, requires_professional_review, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(client_id) DO UPDATE SET bmr=excluded.bmr, tdee=excluded.tdee, calories_min=excluded.calories_min,
         calories_target=excluded.calories_target, calories_max=excluded.calories_max, protein_g=excluded.protein_g,
         carbs_min_g=excluded.carbs_min_g, carbs_max_g=excluded.carbs_max_g, fat_min_g=excluded.fat_min_g, fat_max_g=excluded.fat_max_g,
         fibre_g=excluded.fibre_g, water_ml=excluded.water_ml, method=excluded.method, flags_json=excluded.flags_json,
         requires_professional_review=excluded.requires_professional_review, computed_at=excluded.computed_at`
    )
    .run(
      clientId, t.bmr, t.tdee, t.calories_min, t.calories_target, t.calories_max, t.protein_g, t.carbs_min_g, t.carbs_max_g,
      t.fat_min_g, t.fat_max_g, t.fibre_g, t.water_ml, t.method, JSON.stringify(t.flags), t.requires_professional_review ? 1 : 0
    );
  return t;
}

export type OnboardingData = {
  first_name: string; last_name: string; email: string; phone: string; date_of_birth: string; gender: string;
  address: string; delivery_address: string; delivery_notes: string; emergency_contact: string; source: string;
  height_cm: number | null; weight_kg: number | null; target_weight_kg: number | null; activity_level: string; fitness_level: string;
  blood_type: string; training_schedule: string; lifestyle: string; sleep_hours: number | null; water_litres: number | null; stress_level: string;
  is_pregnant: boolean; is_breastfeeding: boolean; medical_conditions: string; medications: string; eating_disorder_history: boolean;
  medically_restricted_diet: string; other_notes: string;
  dietary_pattern: string; dietary_tags: string[]; cuisines: string[]; liked_foods: string[]; disliked_foods: string[];
  meals_per_day: number; include_snacks: boolean; meal_times: Record<string, string>; people_served: number; cooking_preference: string;
  spice_level: string; budget_per_meal_zar: number | null; budget_per_week_zar: number | null; preferred_delivery_days: string[];
  allergies: { kind: string; allergen: string; severity: string; notes?: string }[];
  goal_type: string; goal_description: string; goal_target_value: number | null; goal_target_date: string | null;
  consents: { data_processing: boolean; health_data: boolean; marketing: boolean; terms: boolean };
  consent_version: string;
  password?: string; // creates a portal login when supplied
  created_by?: number | null;
};

export function createClientFromOnboarding(d: OnboardingData): number {
  const db = getDb();
  const tx = db.transaction(() => {
    let userId: number | null = null;
    if (d.password && d.email) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(d.email) as { id: number } | undefined;
      if (existing) throw new Error("An account with this email already exists.");
      const r = db.prepare("INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, 'client', ?)")
        .run(d.email, hashPassword(d.password), `${d.first_name} ${d.last_name}`.trim(), d.phone);
      userId = Number(r.lastInsertRowid);
    }
    const r = db
      .prepare(
        `INSERT INTO clients (user_id, first_name, last_name, email, phone, date_of_birth, gender, address, delivery_address, delivery_notes, emergency_contact, status, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'onboarding', ?)`
      )
      .run(userId, d.first_name, d.last_name, d.email, d.phone, d.date_of_birth || null, d.gender, d.address, d.delivery_address || d.address, d.delivery_notes, d.emergency_contact, d.source);
    const clientId = Number(r.lastInsertRowid);
    db.prepare(
      `INSERT INTO client_health_profiles (client_id, height_cm, weight_kg, target_weight_kg, activity_level, fitness_level, blood_type, training_schedule, lifestyle,
         sleep_hours, water_litres, stress_level, is_pregnant, is_breastfeeding, medical_conditions, medications, eating_disorder_history, medically_restricted_diet, other_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      clientId, d.height_cm, d.weight_kg, d.target_weight_kg, d.activity_level, d.fitness_level, d.blood_type, d.training_schedule, d.lifestyle,
      d.sleep_hours, d.water_litres, d.stress_level, d.is_pregnant ? 1 : 0, d.is_breastfeeding ? 1 : 0, d.medical_conditions, d.medications,
      d.eating_disorder_history ? 1 : 0, d.medically_restricted_diet, d.other_notes
    );
    db.prepare(
      `INSERT INTO client_preferences (client_id, dietary_pattern, dietary_tags, cuisines, liked_foods, disliked_foods, meals_per_day, include_snacks, meal_times,
         people_served, cooking_preference, spice_level, budget_per_meal_zar, budget_per_week_zar, preferred_delivery_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      clientId, d.dietary_pattern, JSON.stringify(d.dietary_tags), JSON.stringify(d.cuisines), JSON.stringify(d.liked_foods), JSON.stringify(d.disliked_foods),
      d.meals_per_day, d.include_snacks ? 1 : 0, JSON.stringify(d.meal_times), d.people_served, d.cooking_preference, d.spice_level,
      d.budget_per_meal_zar, d.budget_per_week_zar, JSON.stringify(d.preferred_delivery_days)
    );
    const insA = db.prepare("INSERT INTO client_allergies (client_id, kind, allergen, severity, notes) VALUES (?, ?, ?, ?, ?)");
    for (const a of d.allergies) if (a.allergen.trim()) insA.run(clientId, a.kind, a.allergen.trim(), a.severity, a.notes ?? "");
    db.prepare("INSERT INTO client_goals (client_id, goal_type, description, target_value, target_unit, target_date, is_primary) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .run(clientId, d.goal_type, d.goal_description, d.goal_target_value, d.goal_target_value ? "kg" : "", d.goal_target_date);
    if (d.weight_kg) db.prepare("INSERT INTO client_measurements (client_id, measured_at, weight_kg, notes) VALUES (?, date('now'), ?, 'Onboarding')").run(clientId, d.weight_kg);
    const insC = db.prepare("INSERT INTO client_consents (client_id, consent_type, version, granted) VALUES (?, ?, ?, ?)");
    for (const [k, v] of Object.entries(d.consents)) insC.run(clientId, k, d.consent_version, v ? 1 : 0);
    return clientId;
  });
  const clientId = tx();
  const targets = recomputeTargets(clientId);
  audit(d.created_by ?? null, "create", "client", clientId, "Onboarding submitted");
  emit("client.created", { client_id: clientId, requires_professional_review: targets.requires_professional_review });
  emit("assessment.received", { client_id: clientId });
  return clientId;
}

export function updateClientSection(clientId: number, table: "clients" | "client_health_profiles" | "client_preferences", fields: Record<string, unknown>, userId: number | null) {
  const db = getDb();
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const idCol = table === "clients" ? "id" : "client_id";
  const extra = table === "clients" ? "" : ", updated_at = datetime('now')";
  db.prepare(`UPDATE ${table} SET ${set}${extra} WHERE ${idCol} = ?`).run(...keys.map((k) => fields[k]), clientId);
  audit(userId, "update", table, clientId, keys.join(","));
  if (table !== "clients") recomputeTargets(clientId);
}

export function setAllergies(clientId: number, allergies: { kind: string; allergen: string; severity: string; notes?: string }[], userId: number | null) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM client_allergies WHERE client_id = ?").run(clientId);
    const ins = db.prepare("INSERT INTO client_allergies (client_id, kind, allergen, severity, notes) VALUES (?, ?, ?, ?, ?)");
    for (const a of allergies) if (a.allergen.trim()) ins.run(clientId, a.kind, a.allergen.trim(), a.severity, a.notes ?? "");
  })();
  audit(userId, "update", "client_allergies", clientId, `${allergies.length} entries`);
  recomputeTargets(clientId);
}

export function setPrimaryGoal(clientId: number, goal: { goal_type: string; description: string; target_value: number | null; target_date: string | null }, userId: number | null) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE client_goals SET is_primary = 0 WHERE client_id = ?").run(clientId);
    db.prepare("INSERT INTO client_goals (client_id, goal_type, description, target_value, target_unit, target_date, is_primary) VALUES (?, ?, ?, ?, 'kg', ?, 1)")
      .run(clientId, goal.goal_type, goal.description, goal.target_value, goal.target_date);
  })();
  audit(userId, "update", "client_goals", clientId, goal.goal_type);
  recomputeTargets(clientId);
}

export function recordProfessionalReview(clientId: number, r: { reviewer_name: string; reviewer_role: string; outcome: string; notes: string }, userId: number | null) {
  getDb().prepare("INSERT INTO professional_reviews (client_id, reviewer_name, reviewer_role, outcome, notes, reviewed_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .run(clientId, r.reviewer_name, r.reviewer_role, r.outcome, r.notes);
  audit(userId, "review", "client", clientId, r.outcome);
}

export function hasApprovedReview(clientId: number): boolean {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM professional_reviews WHERE client_id = ? AND outcome IN ('approved','approved_with_limits')").get(clientId) as { n: number };
  return row.n > 0;
}

export type TimelineEvent = { at: string; kind: string; title: string; detail: string; link?: string };

export function clientTimeline(clientId: number): TimelineEvent[] {
  const db = getDb();
  const ev: TimelineEvent[] = [];
  const c = getClient(clientId);
  if (!c) return ev;
  ev.push({ at: c.registered_at, kind: "registration", title: "Registered", detail: c.source ? `Source: ${c.source}` : "" });
  const hp = db.prepare("SELECT updated_at FROM client_health_profiles WHERE client_id = ?").get(clientId) as { updated_at: string } | undefined;
  if (hp) ev.push({ at: hp.updated_at, kind: "assessment", title: "Health assessment", detail: "Profile captured / updated" });
  for (const r of db.prepare("SELECT * FROM professional_reviews WHERE client_id = ?").all(clientId) as { created_at: string; outcome: string; reviewer_name: string }[])
    ev.push({ at: r.created_at, kind: "review", title: `Professional review: ${r.outcome}`, detail: r.reviewer_name });
  for (const p of db.prepare("SELECT id, week_start, status, created_at FROM meal_plans WHERE client_id = ?").all(clientId) as { id: number; week_start: string; status: string; created_at: string }[])
    ev.push({ at: p.created_at, kind: "plan", title: `Meal plan — week of ${p.week_start}`, detail: p.status, link: `/meal-plans/${p.id}` });
  for (const o of db.prepare("SELECT id, order_number, status, total_zar, delivery_date, created_at FROM orders WHERE client_id = ?").all(clientId) as { id: number; order_number: string; status: string; total_zar: number; delivery_date: string; created_at: string }[])
    ev.push({ at: o.created_at, kind: "order", title: `Order ${o.order_number}`, detail: `${o.status} · R${o.total_zar.toFixed(0)} · delivery ${o.delivery_date}`, link: `/orders/${o.id}` });
  for (const p of db.prepare("SELECT amount_zar, method, paid_at FROM payments WHERE client_id = ?").all(clientId) as { amount_zar: number; method: string; paid_at: string }[])
    ev.push({ at: p.paid_at, kind: "payment", title: `Payment R${p.amount_zar.toFixed(0)}`, detail: p.method });
  for (const d of db.prepare("SELECT delivery_date, status, delivered_at FROM deliveries WHERE client_id = ?").all(clientId) as { delivery_date: string; status: string; delivered_at: string | null }[])
    ev.push({ at: d.delivered_at ?? d.delivery_date, kind: "delivery", title: `Delivery ${d.status}`, detail: d.delivery_date });
  for (const f of db.prepare("SELECT overall, comment, created_at FROM feedback WHERE client_id = ?").all(clientId) as { overall: number | null; comment: string; created_at: string }[])
    ev.push({ at: f.created_at, kind: "feedback", title: `Feedback ${f.overall ?? "—"}/5`, detail: f.comment });
  for (const m of db.prepare("SELECT measured_at, weight_kg FROM client_measurements WHERE client_id = ?").all(clientId) as { measured_at: string; weight_kg: number | null }[])
    ev.push({ at: m.measured_at, kind: "measurement", title: `Weight ${m.weight_kg ?? "—"} kg`, detail: "" });
  for (const s of db.prepare("SELECT s.created_at, s.status, s.meals_per_week, s.frequency FROM subscriptions s WHERE client_id = ?").all(clientId) as { created_at: string; status: string; meals_per_week: number; frequency: string }[])
    ev.push({ at: s.created_at, kind: "subscription", title: `Subscription ${s.meals_per_week} meals/${s.frequency}`, detail: s.status });
  for (const m of db.prepare("SELECT channel, template, created_at, status FROM communications WHERE client_id = ?").all(clientId) as { channel: string; template: string; created_at: string; status: string }[])
    ev.push({ at: m.created_at, kind: "communication", title: `${m.channel}: ${m.template.replace(/_/g, " ")}`, detail: m.status });
  return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function listProgress(clientId: number): ProgressRow[] {
  return getDb().prepare("SELECT * FROM client_progress WHERE client_id = ? ORDER BY logged_at").all(clientId) as ProgressRow[];
}

export function addProgress(clientId: number, p: Omit<ProgressRow, "id" | "client_id">) {
  getDb().prepare(
    "INSERT INTO client_progress (client_id, logged_at, weight_kg, waist_cm, adherence_pct, energy, satisfaction, water_litres, exercise_minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(clientId, p.logged_at, p.weight_kg, p.waist_cm, p.adherence_pct, p.energy, p.satisfaction, p.water_litres, p.exercise_minutes, p.notes);
  if (p.weight_kg) {
    getDb().prepare("INSERT INTO client_measurements (client_id, measured_at, weight_kg, waist_cm, notes) VALUES (?, ?, ?, ?, 'Progress check-in')").run(clientId, p.logged_at, p.weight_kg, p.waist_cm);
    getDb().prepare("UPDATE client_health_profiles SET weight_kg = ?, updated_at = datetime('now') WHERE client_id = ?").run(p.weight_kg, clientId);
    recomputeTargets(clientId);
  }
}

/** Clients with no delivered order in the last 21 days but at least one before. */
export function atRiskClients(): (ClientRow & { last_order: string | null })[] {
  return getDb()
    .prepare(
      `SELECT c.*, (SELECT MAX(delivery_date) FROM orders o WHERE o.client_id = c.id AND o.status NOT IN ('cancelled')) AS last_order
         FROM clients c
        WHERE c.status = 'active' AND c.anonymised_at IS NULL
          AND last_order IS NOT NULL AND last_order < date('now', '-21 days')
          AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.client_id = c.id AND s.status = 'active')
        ORDER BY last_order`
    )
    .all() as (ClientRow & { last_order: string | null })[];
}

/** POPIA: export everything we hold about a client. */
export function exportClientData(clientId: number): Record<string, unknown> {
  const db = getDb();
  const tables = [
    "clients", "client_health_profiles", "client_preferences", "client_allergies", "client_goals", "client_measurements",
    "client_nutrition_targets", "client_consents", "professional_reviews", "meal_plans", "orders", "subscriptions", "payments",
    "deliveries", "feedback", "client_progress", "communications",
  ];
  const out: Record<string, unknown> = {};
  for (const t of tables) {
    const col = t === "clients" ? "id" : "client_id";
    out[t] = db.prepare(`SELECT * FROM ${t} WHERE ${col} = ?`).all(clientId).map((r) => {
      const row = r as Record<string, unknown>;
      delete row.photo_blob; delete row.proof_blob;
      return row;
    });
  }
  return out;
}

/** POPIA: anonymise personal data while keeping financial records intact. */
export function anonymiseClient(clientId: number, userId: number | null) {
  const db = getDb();
  db.transaction(() => {
    const c = getClient(clientId);
    if (!c) return;
    db.prepare(
      `UPDATE clients SET first_name = 'Deleted', last_name = 'Client', email = '', phone = '', date_of_birth = NULL, address = '', delivery_address = '',
         delivery_notes = '', emergency_contact = '', photo_blob = NULL, photo_mime = NULL, notes = '', status = 'churned', anonymised_at = datetime('now'), user_id = NULL WHERE id = ?`
    ).run(clientId);
    db.prepare("DELETE FROM client_health_profiles WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_preferences WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_allergies WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_measurements WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_nutrition_targets WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM client_progress WHERE client_id = ?").run(clientId);
    db.prepare("DELETE FROM communications WHERE client_id = ?").run(clientId);
    db.prepare("UPDATE deliveries SET address = '', proof_blob = NULL, proof_note = '' WHERE client_id = ?").run(clientId);
    if (c.user_id) db.prepare("UPDATE users SET is_active = 0, email = 'deleted-' || id || '@anonymised.local', name = 'Deleted client' WHERE id = ?").run(c.user_id);
  })();
  audit(userId, "anonymise", "client", clientId, "POPIA deletion request");
}

export function clientPrefsParsed(prefs: PreferencesRow | null) {
  return {
    dietary_tags: parseJson<string[]>(prefs?.dietary_tags, []),
    cuisines: parseJson<string[]>(prefs?.cuisines, []),
    liked: parseJson<string[]>(prefs?.liked_foods, []),
    disliked: parseJson<string[]>(prefs?.disliked_foods, []),
    meal_times: parseJson<Record<string, string>>(prefs?.meal_times, {}),
    delivery_days: parseJson<string[]>(prefs?.preferred_delivery_days, []),
  };
}
