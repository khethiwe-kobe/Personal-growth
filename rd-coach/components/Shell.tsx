"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoachState } from "@/lib/store";
import { PHASES } from "@/lib/types";

const NAV = [
  { href: "/", label: "Coach" },
  { href: "/programme", label: "Programme" },
  { href: "/log", label: "Log" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const state = useCoachState();
  const phase = PHASES.find((p) => p.id === state.phase) ?? PHASES[0];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden md:flex flex-col gap-8 border-r border-line bg-surface px-5 py-7 sticky top-0 h-dvh">
        <div>
          <div className="serif text-2xl leading-none">RD Coach</div>
          <div className="text-xs text-ink-3 mt-1.5">Strength and conditioning</div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent-soft text-accent-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="label mb-2">Phase</div>
          <ol className="flex flex-col gap-1.5">
            {PHASES.map((p) => {
              const idx = PHASES.findIndex((x) => x.id === state.phase);
              const i = PHASES.findIndex((x) => x.id === p.id);
              const done = i < idx;
              const current = p.id === state.phase;
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      current ? "bg-accent" : done ? "bg-ink-3" : "bg-line-2"
                    }`}
                  />
                  <span className={current ? "text-ink" : "text-ink-3"}>{p.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-3 mt-2">{phase.blurb}</p>
        </div>
      </aside>

      <div className="flex flex-col min-h-dvh">
        <header className="md:hidden flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <div className="serif text-lg">RD Coach</div>
          <div className="text-xs text-ink-3">{phase.label}</div>
        </header>
        <main className="flex-1 flex flex-col pb-16 md:pb-0">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-line bg-surface flex">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex-1 py-3 text-center text-xs ${active ? "text-accent-ink font-medium" : "text-ink-3"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
