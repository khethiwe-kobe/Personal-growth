import { all, get, run } from "./db";
import crypto from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Authentication: scrypt password hashing + opaque session tokens.
 * The cookie carries a random 256-bit token; only its SHA-256 hash is stored.
 */

const COOKIE = "cadence_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  username: string;
  display_name: string;
  role: "student" | "working";
  bio: string;
  timezone: string;
  appearance: "light" | "dark" | "system";
  accent: string;
  has_avatar: boolean;
  email: string | null;
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    tokenHash(token),
    userId,
    expires.toISOString(),
  ]);
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
  if (token) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(token)]);
  }
  jar.delete(COOKIE);
}

/** Current user or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = (await get(
    `SELECT u.id, u.username, u.display_name, u.role, u.bio, u.timezone,
            u.appearance, u.accent, u.email,
            (u.avatar_blob IS NOT NULL) AS has_avatar,
            s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [tokenHash(token)]
  )) as
    | (Omit<SessionUser, "has_avatar"> & { expires_at: string; has_avatar: number })
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(token)]);
    return null;
  }
  const { expires_at: _e, ...rest } = row;
  return { ...rest, has_avatar: !!row.has_avatar };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user!;
}

/** Group members (active) for the group the user belongs to. */
export async function getGroupForUser(userId: number) {
  const group = (await get(
    `SELECT g.* FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ? AND gm.left_at IS NULL
     LIMIT 1`,
    [userId]
  )) as { id: number; name: string; invite_code: string } | undefined;
  if (!group) return null;
  const members = (await all(
    `SELECT u.id, u.username, u.display_name, u.role, u.bio, u.accent, u.timezone,
            (u.avatar_blob IS NOT NULL) AS has_avatar
       FROM group_members gm JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND gm.left_at IS NULL
      ORDER BY gm.joined_at`,
    [group.id]
  )) as {
    id: number; username: string; display_name: string; role: string;
    bio: string; accent: string; timezone: string; has_avatar: number;
  }[];
  return { group, members: members.map((m) => ({ ...m, has_avatar: !!m.has_avatar })) };
}
