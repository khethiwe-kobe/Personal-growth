import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * SQLite connection (singleton per process). The schema in lib/schema.sql is
 * idempotent (CREATE IF NOT EXISTS) and written in portable SQL so the same
 * data model can move to Postgres when the business outgrows a single file.
 */
const DB_PATH =
  process.env.MEALPREP_DB_PATH || path.join(process.cwd(), "data", "mealprep.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

/** Open an isolated in-memory database (tests). */
export function openMemoryDb(): Database.Database {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  migrate(d);
  return d;
}

export function migrate(d: Database.Database) {
  const sql = fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
  d.exec(sql);
  seedDefaults(d);
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  brand_name: "Nourish & Co.",
  tagline: "Nutrition, prepared for your life.",
  currency: "ZAR",
  timezone: "Africa/Johannesburg",
  default_packaging_cost: "6.50",
  labour_rate_per_hour: "45",
  overhead_per_meal: "8",
  delivery_cost_per_order: "35",
  default_waste_pct: "5",
  target_margin_conservative: "0.45",
  target_margin_standard: "0.55",
  target_margin_premium: "0.65",
  kitchen_capacity_meals_per_day: "200",
  consent_version: "2026-01",
  disclaimer:
    "Nutrition figures are estimates based on recognised equations and ingredient data. They are general guidance, not medical advice, and do not replace a registered dietitian or doctor.",
};

function seedDefaults(d: Database.Database) {
  const ins = d.prepare(
    "INSERT OR IGNORE INTO business_settings (key, value) VALUES (?, ?)"
  );
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  const loc = d.prepare("SELECT COUNT(*) AS n FROM locations").get() as { n: number };
  if (loc.n === 0) {
    d.prepare("INSERT INTO locations (name, address) VALUES (?, ?)").run(
      "Main kitchen",
      ""
    );
  }
}

export function getSetting(key: string, d: Database.Database = getDb()): string {
  const row = d.prepare("SELECT value FROM business_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export function getSettingNumber(key: string, d: Database.Database = getDb()): number {
  const n = Number(getSetting(key, d));
  return Number.isFinite(n) ? n : 0;
}

export function getAllSettings(d: Database.Database = getDb()): Record<string, string> {
  const rows = d.prepare("SELECT key, value FROM business_settings").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string, d: Database.Database = getDb()) {
  d.prepare(
    `INSERT INTO business_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}
