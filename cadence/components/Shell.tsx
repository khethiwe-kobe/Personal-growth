"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import {
  IconHome, IconSun, IconTarget, IconCalendar, IconGrid, IconTimer,
  IconChart, IconUsers, IconBook, IconUser,
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft font-display text-lg font-semibold text-accent-ink">
            C
          </span>
          <span className="font-display text-lg font-medium tracking-tight">Cadence</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
                isActive(href)
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={17} className={isActive(href) ? "text-accent-ink" : "text-ink-3"} />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/settings"
          className="mt-4 flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-2"
        >
          <Avatar name={user.display_name} accent={user.accent} userId={user.id}
            hasAvatar={user.has_avatar} size={30} />
          <span className="truncate text-sm font-medium">{user.display_name}</span>
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
