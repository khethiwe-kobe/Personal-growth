import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { newId, sql } from "./db";
import type { Member } from "../types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "rdc_session";
const SESSION_DAYS = 180;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, "hex"), 32);
  const want = Buffer.from(hashHex, "hex");
  return want.length === hash.length && timingSafeEqual(hash, want);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type MemberRow = { id: string; username: string; display_name: string; is_admin: boolean };
const toMember = (r: MemberRow): Member => ({ id: r.id, username: r.username, name: r.display_name, isAdmin: r.is_admin });

/** Start a session and return the Set-Cookie header value. */
export async function startSession(memberId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql("INSERT INTO sessions (token_hash, member_id, expires_at) VALUES ($1, $2, $3)", [tokenHash(token), memberId, expires.toISOString()]);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=") || null;
  }
  return null;
}

export async function endSession(req: Request): Promise<void> {
  const token = readToken(req);
  if (token) await sql("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

/** The signed-in member, or null. Removed members are signed out. */
export async function currentMember(req: Request): Promise<Member | null> {
  const token = readToken(req);
  if (!token) return null;
  const rows = await sql<MemberRow>(
    `SELECT m.id, m.username, m.display_name, m.is_admin
       FROM sessions s JOIN members m ON m.id = s.member_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT m.removed`,
    [tokenHash(token)],
  );
  return rows[0] ? toMember(rows[0]) : null;
}

export class Unauthorized extends Error {}

export async function requireMember(req: Request): Promise<Member> {
  const m = await currentMember(req);
  if (!m) throw new Unauthorized();
  return m;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

export async function createMember(username: string, name: string, password: string): Promise<Member> {
  const id = newId();
  const pass = await hashPassword(password);
  // The first person to join runs the group.
  const rows = await sql<MemberRow>(
    `INSERT INTO members (id, username, display_name, pass_hash, is_admin)
     VALUES ($1, $2, $3, $4, NOT EXISTS (SELECT 1 FROM members))
     RETURNING id, username, display_name, is_admin`,
    [id, username, name, pass],
  );
  return toMember(rows[0]);
}

export async function findLogin(username: string, password: string): Promise<Member | null> {
  const rows = await sql<MemberRow & { pass_hash: string }>(
    "SELECT id, username, display_name, is_admin, pass_hash FROM members WHERE username = $1 AND NOT removed",
    [username],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.pass_hash))) return null;
  return toMember(row);
}

export async function slowly<T>(value: T): Promise<T> {
  await new Promise((r) => setTimeout(r, 600));
  return value;
}
