"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { isDemo } from "@/lib/supabase";
import { cx } from "./ui";

const NAV: Array<{ group: string | null; items: Array<{ href: string; label: string }> }> = [
  { group: null, items: [{ href: "/", label: "Dashboard" }] },
  {
    group: "Expenses",
    items: [
      { href: "/transactions", label: "All transactions" },
      { href: "/rent", label: "Rent" },
      { href: "/groceries", label: "Groceries" },
      { href: "/electricity", label: "Electricity" },
      { href: "/transport", label: "Transport" },
    ],
  },
  {
    group: "Meals",
    items: [
      { href: "/meals", label: "Meal ideas" },
      { href: "/planner", label: "Meal planner" },
      { href: "/grocery-list", label: "Grocery list" },
    ],
  },
  {
    group: "Business",
    items: [{ href: "/business", label: "Business overview" }],
  },
  {
    group: "Joint account",
    items: [{ href: "/joint", label: "Statements and review" }],
  },
  {
    group: "Reports",
    items: [{ href: "/reports", label: "Monthly review" }],
  },
  {
    group: null,
    items: [
      { href: "/activity", label: "Activity" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = (localStorage.getItem("hearth-theme") as "light" | "dark") || "light";
    setTheme(stored);
  }, []);
  const apply = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem("hearth-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };
  return { theme, setTheme: apply };
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {NAV.map((section, i) => (
        <div key={i}>
          {section.group ? (
            <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {section.group}
            </div>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cx(
                    "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-surface-2 font-medium text-ink"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { user, profile, household, loading, signOut } = useApp();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!household) router.replace("/onboarding");
  }, [loading, user, household, router]);

  if (loading || !user || !household) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-6 pt-2">
        <div className="text-lg font-semibold tracking-tight">Hearth</div>
        <div className="mt-0.5 truncate text-xs text-muted">{household.name}</div>
        {isDemo && (
          <div className="mt-1.5 inline-block rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            Demo data
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <NavLinks onNavigate={() => setMenuOpen(false)} />
      </div>
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between px-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {profile?.display_name || profile?.full_name || "You"}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-bg px-4 py-3 lg:hidden">
        <div className="text-base font-semibold tracking-tight">Hearth</div>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="h-full w-72 overflow-y-auto border-r border-border bg-bg p-4 pt-6"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border p-4 pt-6 lg:block">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 p-4 pb-16 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
