"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import {
  IconHome, IconSun, IconTarget, IconCalendar, IconGrid, IconTimer, IconChart, IconUsers, IconBook, IconUser, IconChevronL,
} from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome },
  { href: "/today", label: "Today", icon: IconSun },
  { href: "/goals", label: "Goals", icon: IconTarget },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/timetable", label: "Timetable", icon: IconGrid },
  { href: "/focus", label: "Focus", icon: IconTimer },
  { href: "/analytics", label: "Analytics", icon: IconChart },
  { href: "/accountability", label: "Accountability", icon: IconUsers },
  { href: "/review", label: "Monthly Review", icon: IconBook },
  { href: "/settings", label: "Profile & Settings", icon: IconUser },
];

const MOBILE = ["/dashboard", "/today", "/goals", "/focus", "/accountability"];

export default function Shell({
  user, children,
}: {
  user: { display_name: string; accent: string; id: number; has_avatar: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Collapsed to icons only. Remembered per browser so the choice sticks
  // between visits; read after mount so the server and client markup match.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("cadence:nav-collapsed") === "1");
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("cadence:nav-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px]">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line py-6 transition-[width] duration-200 md:flex ${
          collapsed ? "w-[4.5rem] px-2" : "w-56 px-3"
        }`}
      >
        <Link
          href="/dashboard"
          className={`mb-2 flex items-center gap-2 px-2 ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Cadence" : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-lg font-semibold text-accent-ink">
            C
          </span>
          {!collapsed && (
            <span className="font-display text-lg font-medium tracking-tight">Cadence</span>
          )}
        </Link>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand" : "Collapse"}
          className={`mb-4 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <IconChevronL
            size={15}
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && "Collapse"}
        </button>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 rounded-xl py-2 text-sm ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                isActive(href)
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={17} className={isActive(href) ? "text-accent-ink" : "text-ink-3"} />
              {!collapsed && label}
            </Link>
          ))}
        </nav>
        <Link
          href="/settings"
          title={collapsed ? user.display_name : undefined}
          className={`mt-4 flex items-center gap-2.5 rounded-xl py-2 hover:bg-surface-2 ${
            collapsed ? "justify-center px-0" : "px-2"
          }`}
        >
          <Avatar name={user.display_name} accent={user.accent} userId={user.id}
            hasAvatar={user.has_avatar} size={30} />
          {!collapsed && <span className="truncate text-sm font-medium">{user.display_name}</span>}
        </Link>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] ${
                isActive(href) ? "text-accent-ink" : "text-ink-3"
              }`}
            >
              <Icon size={20} />
              {label.split(" ")[0]}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
