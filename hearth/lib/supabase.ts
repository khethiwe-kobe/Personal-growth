"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo";

let client: SupabaseClient | null = null;

export const isDemo = process.env.NEXT_PUBLIC_DEMO === "1";

export function supabaseConfigured(): boolean {
  return (
    isDemo ||
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  );
}

export function getSupabase(): SupabaseClient {
  if (isDemo) {
    if (!client) client = createDemoClient() as SupabaseClient;
    return client;
  }
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    client = createClient(url, key);
  }
  return client;
}
