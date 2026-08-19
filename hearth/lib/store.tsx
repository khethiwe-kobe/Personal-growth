"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";
import type { Category, Household, Profile } from "./types";
import { normHousehold, num } from "./types";

type AppState = {
  sb: SupabaseClient;
  user: User | null;
  profile: Profile | null;
  household: Household | null;
  members: Profile[];
  categories: Category[];
  loading: boolean;
  /** ids of everyone in the household */
  memberIds: string[];
  nameOf: (id: string | null | undefined) => string;
  isMe: (id: string | null | undefined) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const configured = supabaseConfigured();
  const sb = useMemo(() => (configured ? getSupabase() : null), [configured]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBootstrap = useCallback(
    async (u: User | null) => {
      if (!sb || !u) {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setCategories([]);
        setLoading(false);
        return;
      }
      const { data: prof } = await sb
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();
      setProfile((prof as Profile) ?? null);

      const { data: memberships } = await sb
        .from("household_members")
        .select("household_id")
        .eq("user_id", u.id)
        .limit(1);
      const hid = memberships?.[0]?.household_id as string | undefined;
      if (!hid) {
        setHousehold(null);
        setMembers([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      const [{ data: hh }, { data: mem }, { data: cats }] = await Promise.all([
        sb.from("households").select("*").eq("id", hid).single(),
        sb.from("household_members").select("user_id, profile:profiles(*)").eq("household_id", hid),
        sb.from("categories").select("*").eq("household_id", hid).order("sort"),
      ]);
      setHousehold(hh ? normHousehold(hh) : null);
      setMembers(
        ((mem ?? []) as Array<{ profile: Profile | Profile[] }>)
          .map((m) => (Array.isArray(m.profile) ? m.profile[0] : m.profile))
          .filter(Boolean),
      );
      setCategories(
        ((cats ?? []) as Category[]).map((c) => ({ ...c, sort: num(c.sort) })),
      );
      setLoading(false);
    },
    [sb],
  );

  useEffect(() => {
    if (!sb) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      loadBootstrap(data.session?.user ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      loadBootstrap(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [sb, loadBootstrap]);

  const refresh = useCallback(async () => {
    await loadBootstrap(user);
  }, [loadBootstrap, user]);

  const signOut = useCallback(async () => {
    if (sb) await sb.auth.signOut();
  }, [sb]);

  const nameOf = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "—";
      const m = members.find((p) => p.id === id);
      if (!m) return "Unknown";
      return m.id === user?.id ? "You" : m.display_name || m.full_name || "Unknown";
    },
    [members, user],
  );

  const isMe = useCallback(
    (id: string | null | undefined) => Boolean(id && id === user?.id),
    [user],
  );

  const value: AppState = {
    sb: sb as SupabaseClient,
    user,
    profile,
    household,
    members,
    categories,
    loading,
    memberIds: members.map((m) => m.id),
    nameOf,
    isMe,
    refresh,
    signOut,
  };

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-border bg-surface p-8 text-sm leading-relaxed text-muted">
          <p className="mb-2 text-base font-semibold text-ink">Hearth is not connected yet</p>
          <p>
            Set <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your
            environment (see <code className="text-ink">.env.example</code> and the README),
            then restart or redeploy.
          </p>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
