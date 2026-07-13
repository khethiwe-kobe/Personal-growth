"use client";

// Optional Supabase layer. The app is local-first and fully usable without it;
// when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
// (see README), sign-in and cloud backup become available in Settings.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exportBundle, importBundle } from "./storage";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key
      ? createClient(url, key, {
          auth: {
            // Implicit flow delivers the session in the URL hash, so a magic
            // link works even when opened on a different device or browser
            // from the one that requested it (PKCE would fail there).
            flowType: "implicit",
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true,
          },
        })
      : null;
  return client;
}

export function supabaseConfigured(): boolean {
  return getSupabase() !== null;
}

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
  return error ? { error: error.message } : {};
}

/** Password sign-in — sends no email, so it never hits the email rate limit. */
export async function signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

/** Create an account with a password. Signs in immediately when email
 *  confirmation is disabled in Supabase; otherwise a confirmation email is sent. */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ error?: string; needsConfirm?: boolean }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { needsConfirm: !data.session };
}

export async function currentUserEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/** Notify when auth state changes (e.g. a magic link completes sign-in). */
export function onAuthChange(cb: (email: string | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user?.email ?? null);
  });
  return () => data.subscription.unsubscribe();
}

/** Push the whole local bundle to the user's row in app_state. */
export async function backupToCloud(): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Sign in first" };
  const { error } = await sb.from("app_state").upsert({
    user_id: user.id,
    data: JSON.parse(exportBundle()),
    updated_at: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

/** Pull the cloud bundle and replace local state. */
export async function restoreFromCloud(): Promise<{ error?: string; keys?: number }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Sign in first" };
  const { data, error } = await sb.from("app_state").select("data").eq("user_id", user.id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No cloud backup found yet" };
  const keys = importBundle(JSON.stringify(data.data));
  return { keys };
}

// ---- Lower-level helpers for automatic sync (see lib/sync.ts) ----

/** Fetch the cloud state and its server timestamp, or null if none exists. */
export async function fetchCloudState(): Promise<
  { data: unknown; updatedAt: string } | null | { error: string }
> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in" };
  const { data, error } = await sb
    .from("app_state")
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return null;
  return { data: data.data, updatedAt: data.updated_at as string };
}

/** Upsert the current local bundle to the cloud; returns the new server timestamp. */
export async function pushCloudState(): Promise<{ updatedAt: string } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured" };
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in" };
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from("app_state").upsert({
    user_id: user.id,
    data: JSON.parse(exportBundle()),
    updated_at: updatedAt,
  });
  return error ? { error: error.message } : { updatedAt };
}

/** Import a raw cloud bundle object into local storage. Returns key count. */
export function applyCloudBundle(bundle: unknown): number {
  return importBundle(JSON.stringify(bundle));
}
