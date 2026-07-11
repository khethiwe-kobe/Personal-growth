"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
      { href: "/relationships", label: "Relationships" },
      { href: "/vision", label: "Vision Board" },
      { href: "/reflection", label: "Reflection" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

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

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Page content depends on the current date and locally stored data, neither of
  // which exists at prerender time — mount it client-side to avoid hydration drift.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
                  <NavLink key={it.href} {...it} active={pathname === it.href} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar — mobile & tablet */}
        <div className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Link href="/" className="font-display text-xl text-ink">
              Selah
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 py-2">
            {NAV.flatMap((g) => g.items).map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                  pathname === it.href ? "bg-beige font-medium text-brown-deep" : "text-soft"
                }`}
              >
                {it.label}
              </Link>
            ))}
          </nav>
        </div>

        <main className="px-4 py-8 sm:px-8 lg:px-10">{mounted ? children : null}</main>
      </div>
    </div>
  );
}
