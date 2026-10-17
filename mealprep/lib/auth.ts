import { getDb } from "./db";
import crypto from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role, UserRow } from "./types";
import { hashPassword, verifyPassword } from "./password";

/**
 * Authentication: scrypt password hashing + opaque session tokens (hash-only
 * storage) + a role → permission matrix enforced in server actions/layouts.
 */
const COOKIE = "mealprep_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  client_id: number | null;
};

export { hashPassword, verifyPassword };

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), userId, expires.toISOString());
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  jar.delete(COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, s.expires_at,
              (SELECT c.id FROM clients c WHERE c.user_id = u.id LIMIT 1) AS client_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    )
    .get(tokenHash(token)) as
    | (SessionUser & { expires_at: string; is_active: number })
    | undefined;
  if (!row || !row.is_active) return null;
  if (new Date(row.expires_at) < new Date()) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, client_id: row.client_id ?? null };
});

export function authenticate(email: string, password: string): UserRow | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(email) as UserRow | undefined;
  if (!row) return null;
  return verifyPassword(password, row.password_hash) ? row : null;
}

// ----------------------------------------------------------------- RBAC
export type Permission =
  | "dashboard:view" | "clients:view" | "clients:edit" | "health:view" | "health:edit"
  | "meals:view" | "meals:edit" | "plans:view" | "plans:edit" | "orders:view" | "orders:edit"
  | "inventory:view" | "inventory:edit" | "suppliers:view" | "suppliers:edit"
  | "production:view" | "production:edit" | "labels:view" | "labels:print"
  | "deliveries:view" | "deliveries:edit" | "finance:view" | "finance:edit"
  | "analytics:view" | "settings:edit" | "users:edit" | "audit:view" | "business:view" | "business:edit"
  | "marketing:view" | "marketing:edit" | "compliance:view" | "compliance:edit" | "assistant:use";

const ALL: Permission[] = [
  "dashboard:view", "clients:view", "clients:edit", "health:view", "health:edit", "meals:view", "meals:edit",
  "plans:view", "plans:edit", "orders:view", "orders:edit", "inventory:view", "inventory:edit", "suppliers:view",
  "suppliers:edit", "production:view", "production:edit", "labels:view", "labels:print", "deliveries:view",
  "deliveries:edit", "finance:view", "finance:edit", "analytics:view", "settings:edit", "users:edit", "audit:view",
  "business:view", "business:edit", "marketing:view", "marketing:edit", "compliance:view", "compliance:edit", "assistant:use",
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  planner: [
    "dashboard:view", "clients:view", "clients:edit", "health:view", "health:edit", "meals:view", "meals:edit",
    "plans:view", "plans:edit", "orders:view", "analytics:view", "assistant:use",
  ],
  kitchen: [
    "dashboard:view", "production:view", "production:edit", "meals:view", "inventory:view", "inventory:edit",
    "suppliers:view", "orders:view", "compliance:view", "compliance:edit",
  ],
  packaging: ["dashboard:view", "labels:view", "labels:print", "orders:view", "production:view", "production:edit"],
  delivery: ["dashboard:view", "deliveries:view", "deliveries:edit", "orders:view"],
  accounting: ["dashboard:view", "finance:view", "finance:edit", "orders:view", "clients:view", "analytics:view", "business:view"],
  client: [],
};

export function can(user: SessionUser | null, perm: Permission): boolean {
  if (!user) return false;
  return PERMISSIONS[user.role]?.includes(perm) ?? false;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user!;
}

/** Staff-only guard with a permission check. Clients are sent to the portal. */
export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "client") {
    const { redirect } = await import("next/navigation");
    redirect("/portal");
  }
  if (!can(user, perm)) {
    const { redirect } = await import("next/navigation");
    redirect("/forbidden");
  }
  return user;
}

/** Client guard: returns the user and their own client id only. */
export async function requireClient(): Promise<SessionUser & { client_id: number }> {
  const user = await requireUser();
  if (user.role !== "client" || !user.client_id) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }
  return user as SessionUser & { client_id: number };
}

/** Throws unless the user holds the permission (for server actions). */
export function assertPermission(user: SessionUser | null, perm: Permission): asserts user is SessionUser {
  if (!can(user, perm)) throw new Error("Forbidden: missing permission " + perm);
}
