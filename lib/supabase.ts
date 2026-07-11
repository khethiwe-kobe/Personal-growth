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
  client = url && key ? createClient(url, key) : null;
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

export async function currentUserEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
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
