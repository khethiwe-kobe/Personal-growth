import { AsyncLocalStorage } from "async_hooks";
import path from "path";
import fs from "fs";
import { SCHEMA, SCHEMA_VERSION, ID_TABLES } from "./schema";
import { bootstrap } from "./seed-core";

/**
 * Postgres connection layer.
 *
 * - DATABASE_URL (or POSTGRES_URL, as set by Vercel's Neon integration) → a
 *   pooled connection to Neon or any Postgres. This is the production setup:
 *   one shared, persistent database for every serverless instance.
 * - Otherwise an in-process Postgres (PGlite). Locally it persists under
 *   data/pglite; on serverless hosts it lives in memory and re-creates the demo
 *   business on a cold start (the "ephemeral demo").
 *
 * The API mirrors the small slice of better-sqlite3 the app was written
 * against (prepare → get/all/run, pluck, transaction) but every call returns a
 * promise. `?` placeholders are rewritten to `$1, $2, …`. INSERTs into tables
 * with an identity `id` get `RETURNING id` appended so `lastInsertRowid` works.
 * Transactions are tracked with AsyncLocalStorage, so any helper called inside
 * one (audit, automation, repo functions) runs on the same connection.
 */

const SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

/** True when each serverless instance keeps its own throwaway demo database. */
export const EPHEMERAL_DEMO = !DATABASE_URL && SERVERLESS;

/**
 * Demo data (sample clients, orders, staff logins with public passwords) is
 * loaded into an empty database only when explicitly enabled, or always for the
 * in-process database. A real Postgres starts with the starter catalogue and the
 * owner account from MEALPREP_OWNER_EMAIL / MEALPREP_OWNER_PASSWORD.
 */
export const DEMO_DATA = DATABASE_URL ? process.env.MEALPREP_DEMO_DATA === "1" : process.env.MEALPREP_DEMO_DATA !== "0";

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; rowCount: number };
type Conn = { query(sql: string, params: unknown[]): Promise<QueryResult>; exec(sql: string): Promise<void> };
type Driver = Conn & { begin(): Promise<{ conn: Conn; release(): void }>; close(): Promise<void> };

export type RunResult = { changes: number; lastInsertRowid: number };

export type Statement = {
  get(...params: unknown[]): Promise<unknown>;
  all(...params: unknown[]): Promise<unknown[]>;
  run(...params: unknown[]): Promise<RunResult>;
  /** Return the first column of each row instead of the row object. */
  pluck(): Statement;
};

export type Db = {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  /** Wrap fn in a transaction; nested calls become savepoints. */
  transaction<A extends unknown[], R>(fn: (...args: A) => R | Promise<R>): (...args: A) => Promise<R>;
};

// ------------------------------------------------------------------ drivers
const NUMBER_OIDS = [20, 1700]; // int8 (COUNT, SUM of int), numeric (AVG, ROUND)

async function pgDriver(url: string): Promise<Driver> {
  const pg = (await import("pg")).default;
  for (const oid of NUMBER_OIDS) pg.types.setTypeParser(oid, (v: string) => (v === null ? null : Number(v)));
  const pool = new pg.Pool({ connectionString: url, max: SERVERLESS ? 3 : 10, idleTimeoutMillis: 10_000 });
  // Neon closes idle connections (and suspends idle databases); the pool replaces them.
  pool.on("error", (e) => console.warn("Postgres idle connection closed:", e.message));
  const wrap = (q: { query: typeof pool.query }): Conn => ({
    async query(sql, params) {
      const r = await q.query(sql, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
    async exec(sql) { await q.query(sql); },
  });
  return {
    ...wrap(pool),
    async begin() {
      const client = await pool.connect();
      return { conn: wrap(client as unknown as { query: typeof pool.query }), release: () => client.release() };
    },
    close: () => pool.end(),
  };
}

async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  let dataDir: string | undefined;
  if (!SERVERLESS) {
    dataDir = process.env.MEALPREP_PGLITE_DIR || path.join(process.cwd(), "data", "pglite");
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const parsers = Object.fromEntries(NUMBER_OIDS.map((oid) => [oid, (v: string) => Number(v)]));
  const db = new PGlite({ dataDir, parsers });
  await db.waitReady;
  // One connection: a transaction must hold it exclusively until it ends.
  let lock: Promise<void> = Promise.resolve();
  const exclusive = async <T>(fn: () => Promise<T>): Promise<T> => {
    const prev = lock;
    let done!: () => void;
    lock = new Promise((r) => (done = r));
    await prev;
    try { return await fn(); } finally { done(); }
  };
  const raw: Conn = {
    async query(sql, params) {
      const r = await db.query<Row>(sql, params as unknown[]);
      return { rows: r.rows.map(toBuffers), rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql) { await db.exec(sql); },
  };
  return {
    query: (sql, params) => exclusive(() => raw.query(sql, params)),
    exec: (sql) => exclusive(() => raw.exec(sql)),
    async begin() {
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      let acquired!: () => void;
      const ready = new Promise<void>((r) => (acquired = r));
      void exclusive(() => { acquired(); return held; });
      await ready;
      return { conn: raw, release };
    },
    close: () => db.close(),
  };
}

/** PGlite returns bytea as Uint8Array; the app expects Buffers like node-postgres. */
function toBuffers(row: Row): Row {
  for (const k in row) if (row[k] instanceof Uint8Array && !Buffer.isBuffer(row[k])) row[k] = Buffer.from(row[k] as Uint8Array);
  return row;
}

// ------------------------------------------------------------------ SQL
/** Rewrite `?` placeholders (outside quoted strings) to Postgres `$n`. */
export function toPgParams(sql: string): string {
  let out = "", n = 0, quote: string | null = null;
  for (const ch of sql) {
    if (quote) { if (ch === quote) quote = null; out += ch; continue; }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    out += ch === "?" ? `$${++n}` : ch;
  }
  return out;
}

const INSERT_TABLE = /^\s*INSERT\s+INTO\s+([a-z_]+)/i;

function prepareSql(sql: string): { text: string; returnsId: boolean } {
  let text = toPgParams(sql).trim().replace(/;$/, "");
  const table = INSERT_TABLE.exec(text)?.[1]?.toLowerCase();
  const returnsId = !!table && ID_TABLES.has(table) && !/\bRETURNING\b/i.test(text);
  if (returnsId) text += " RETURNING id";
  return { text, returnsId };
}

// ------------------------------------------------------------------ facade
const txConn = new AsyncLocalStorage<{ conn: Conn; depth: number }>();
let driver: Promise<Driver> | null = null;

function getDriver(): Promise<Driver> {
  if (!driver) {
    driver = (async () => {
      const d = DATABASE_URL ? await pgDriver(DATABASE_URL) : await pgliteDriver();
      await migrate(d);
      return d;
    })();
    driver.catch(() => { driver = null; }); // retry on the next request
  }
  return driver;
}

async function conn(): Promise<Conn> {
  return txConn.getStore()?.conn ?? (await getDriver());
}

function statement(sql: string, pluck = false): Statement {
  const { text, returnsId } = prepareSql(sql);
  const exec = async (params: unknown[]) => (await conn()).query(text, params);
  const shape = (r: Row | undefined) => (r && pluck ? Object.values(r)[0] : r);
  return {
    async get(...params) { return shape((await exec(params)).rows[0]); },
    async all(...params) { return (await exec(params)).rows.map(shape); },
    async run(...params) {
      const r = await exec(params);
      return { changes: r.rowCount, lastInsertRowid: returnsId ? Number(r.rows[0]?.id ?? 0) : 0 };
    },
    pluck: () => statement(sql, true),
  };
}

const facade: Db = {
  prepare: (sql) => statement(sql),
  async exec(sql) { await (await conn()).exec(sql); },
  transaction(fn) {
    return async (...args) => {
      const outer = txConn.getStore();
      if (outer) {
        const sp = `sp_${outer.depth + 1}`;
        await outer.conn.exec(`SAVEPOINT ${sp}`);
        try {
          const r = await txConn.run({ conn: outer.conn, depth: outer.depth + 1 }, () => fn(...args));
          await outer.conn.exec(`RELEASE SAVEPOINT ${sp}`);
          return r;
        } catch (e) {
          await outer.conn.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
          throw e;
        }
      }
      const { conn: c, release } = await (await getDriver()).begin();
      try {
        await c.exec("BEGIN");
        const r = await txConn.run({ conn: c, depth: 0 }, () => fn(...args));
        await c.exec("COMMIT");
        return r;
      } catch (e) {
        await c.exec("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        release();
      }
    };
  },
};

export function getDb(): Db {
  return facade;
}

// ------------------------------------------------------------------ schema
/**
 * Create or upgrade the schema, then fill an empty database, all in one
 * transaction. A transaction-scoped advisory lock keeps concurrent cold starts
 * from racing (session locks are unsafe behind Neon's transaction pooler).
 */
async function migrate(d: Driver) {
  const { conn: c, release } = await d.begin();
  try {
    await c.exec("BEGIN");
    await c.exec("SELECT pg_advisory_xact_lock(727001)");
    const meta = await c.query("SELECT to_regclass('public.schema_meta') AS t", []);
    const current = meta.rows[0]?.t
      ? Number((await c.query("SELECT version FROM schema_meta LIMIT 1", [])).rows[0]?.version ?? 0)
      : 0;
    if (current < SCHEMA_VERSION) {
      await c.exec(SCHEMA);
      await c.exec(`DELETE FROM schema_meta; INSERT INTO schema_meta (version) VALUES (${SCHEMA_VERSION})`);
    }
    await txConn.run({ conn: c, depth: 0 }, async () => {
      await seedDefaults(facade);
      await bootstrap(facade, { demo: DEMO_DATA });
    });
    await c.exec("COMMIT");
  } catch (e) {
    await c.exec("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    release();
  }
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

async function seedDefaults(d: Db) {
  const entries = Object.entries(DEFAULT_SETTINGS);
  await d.prepare(
    `INSERT INTO business_settings (key, value) VALUES ${entries.map(() => "(?, ?)").join(", ")} ON CONFLICT (key) DO NOTHING`
  ).run(...entries.flat());
  const loc = (await d.prepare("SELECT COUNT(*) AS n FROM locations").get()) as { n: number };
  if (loc.n === 0) {
    await d.prepare("INSERT INTO locations (name, address) VALUES (?, ?)").run("Main kitchen", "");
  }
}

export async function getSetting(key: string, d: Db = getDb()): Promise<string> {
  const row = (await d.prepare("SELECT value FROM business_settings WHERE key = ?").get(key)) as
    | { value: string }
    | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettingNumber(key: string, d: Db = getDb()): Promise<number> {
  const n = Number(await getSetting(key, d));
  return Number.isFinite(n) ? n : 0;
}

export async function getAllSettings(d: Db = getDb()): Promise<Record<string, string>> {
  const rows = (await d.prepare("SELECT key, value FROM business_settings").all()) as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string, d: Db = getDb()) {
  await d.prepare(
    `INSERT INTO business_settings (key, value, updated_at) VALUES (?, ?, now_text())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

/** Close the connection pool (scripts). */
export async function closeDb() {
  if (!driver) return;
  const d = await driver;
  driver = null;
  await d.close();
}
