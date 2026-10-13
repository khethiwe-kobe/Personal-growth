import { neon } from "@neondatabase/serverless";

/**
 * A tiny query layer. Production uses Neon Postgres over HTTP (DATABASE_URL or
 * POSTGRES_URL, as Vercel's Neon integration sets them). Local development and
 * tests can use an in-process Postgres with DATABASE_URL=pglite:memory.
 */
type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

let queryFn: Promise<Query> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("The database is not connected. Add a Neon Postgres database to the Vercel project (Storage tab).");
  }
  return url;
}

async function connect(): Promise<Query> {
  const url = connectionString();
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const path = url.slice("pglite:".length);
    const db = path === "memory" ? new PGlite() : new PGlite(path);
    return async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  }
  const sql = neon(url);
  return async <T,>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[];
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    removed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS member_state (
    member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    private JSONB NOT NULL,
    public JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    day TEXT NOT NULL,
    data JSONB NOT NULL,
    photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS reactions (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, member_id, kind)
  )`,
];

/** Connect once per server instance and make sure the tables exist. */
export function db(): Promise<Query> {
  if (!queryFn) {
    queryFn = (async () => {
      const q = await connect();
      for (const stmt of SCHEMA) await q(stmt);
      return q;
    })();
    queryFn.catch(() => {
      queryFn = null;
    });
  }
  return queryFn;
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db())<T>(text, params);
}

export function newId(): string {
  return crypto.randomUUID();
}
