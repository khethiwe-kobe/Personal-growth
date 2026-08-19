"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { currentUserEmail, onAuthChange, supabaseConfigured } from "@/lib/supabase";
import { startSync, stopSync, type SyncStatus } from "@/lib/sync";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    group: "Spiritual",
    items: [
      { href: "/bible", label: "Bible Reading" },
      { href: "/library", label: "Scripture Library" },
      { href: "/memory", label: "Scripture Memory" },
      { href: "/prayer", label: "Prayer Journal" },
      { href: "/renew", label: "Renewing My Mind" },
      { href: "/homecell", label: "Homecell" },
    ],
  },
  {
    group: "Body",
    items: [
      { href: "/workouts", label: "Workouts" },
      { href: "/meals", label: "Meals" },
    ],
  },
  {
    group: "Life",
    items: [
      { href: "/habits", label: "Habits" },
      { href: "/goals", label: "Goals" },
      { href: "/business", label: "Side Business" },
      { href: "/relationships", label: "Relationships" },
      { href: "/vision", label: "Vision Board" },
      { href: "/reflection", label: "Reflection" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

/** Compare paths ignoring a trailing slash (static export uses trailingSlash). */
function samePath(a: string, b: string): boolean {
  const norm = (s: string) => (s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s);
  return norm(a) === norm(b);
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-xl px-3 py-1.5 text-sm transition-colors duration-200 ${
        active ? "bg-beige font-medium text-brown-deep" : "text-soft hover:bg-beige/60 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function SyncBadge({ email, status }: { email: string | null; status: SyncStatus }) {
  if (!email) {
    return (
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-soft transition-colors hover:border-brown-faint hover:text-ink"
      >
        Sign in
      </Link>
    );
  }
  const label =
    status === "saving" ? "Saving…" : status === "syncing" ? "Syncing…" : status === "error" ? "Sync issue" : "Saved";
  const dot = status === "error" ? "bg-[#c06a4a]" : status === "synced" || status === "idle" ? "bg-sage" : "bg-brown-faint";
  return (
    <Link href="/settings" className="inline-flex min-w-0 items-center gap-1.5 text-xs text-faint hover:text-soft" title={email}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const bottomNavRef = useRef<HTMLDivElement>(null);
  // The Homecell site carries its own full-bleed CRC theme and navigation.
  const bare = pathname.startsWith("/homecell");

  // Keep the active tab in view within the scrollable bottom bar.
  useEffect(() => {
    const el = bottomNavRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    if (!supabaseConfigured()) return;
    let started = false;
    const begin = (e: string | null) => {
      setEmail(e);
      if (e && !started) {
        started = true;
        startSync((s) => setStatus(s));
      } else if (!e && started) {
        started = false;
        stopSync();
      }
    };
    currentUserEmail().then(begin).catch(() => {});
    const unsub = onAuthChange(begin);
    return unsub;
  }, []);

  if (bare) return <>{mounted ? children : null}</>;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line px-5 py-8 lg:flex">
        <Link href="/" className="mb-8 block">
          <span className="font-display text-2xl tracking-tight text-ink">Selah</span>
          <span className="mt-0.5 block text-xs text-faint">personal growth</span>
        </Link>
        <nav className="space-y-6">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-widest text-faint">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavLink key={it.href} {...it} active={samePath(pathname, it.href)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-6">
          <SyncBadge email={email} status={status} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar — mobile & tablet */}
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="font-display text-xl text-ink">
            Selah
          </Link>
          <SyncBadge email={email} status={status} />
        </div>

        <main className="px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:px-10 lg:pb-8 lg:pt-8">{mounted ? children : null}</main>
      </div>

      {/* Bottom nav — mobile & tablet */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
        <div ref={bottomNavRef} className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
          {ALL_ITEMS.map((it) => {
            const active = samePath(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                data-active={active}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active ? "bg-beige font-medium text-brown-deep" : "text-soft"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
