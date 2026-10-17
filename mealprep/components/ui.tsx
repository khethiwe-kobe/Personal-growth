import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ title, kicker, action, children, className = "" }: { title?: ReactNode; kicker?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || kicker || action) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            {kicker && <div className="kicker mb-0.5">{kicker}</div>}
            {title && <h2 className="text-lg">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "critical" | "neutral"; href?: string }) {
  const toneCls = tone === "good" ? "text-good" : tone === "warn" ? "text-serious" : tone === "critical" ? "text-critical" : "text-ink-3";
  const inner = (
    <div className="card p-4 h-full">
      <div className="kicker">{label}</div>
      <div className="stat-value mt-1">{value}</div>
      {sub && <div className={`text-xs mt-1 ${toneCls}`}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:-translate-y-0.5 transition-transform">{inner}</Link> : inner;
}

const STATUS_TONES: Record<string, string> = {
  inquiry: "bg-bone-2 text-ink-2", quote_sent: "bg-bone-2 text-ink-2", awaiting_payment: "bg-amber-100 text-amber-900", unpaid: "bg-amber-100 text-amber-900", partial: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900", plan_created: "bg-sky-100 text-sky-900", shopping: "bg-sky-100 text-sky-900", preparing: "bg-indigo-100 text-indigo-900", cooking: "bg-indigo-100 text-indigo-900",
  portioning: "bg-indigo-100 text-indigo-900", packaging: "bg-violet-100 text-violet-900", quality_check: "bg-violet-100 text-violet-900", ready: "bg-emerald-100 text-emerald-900",
  out_for_delivery: "bg-teal-100 text-teal-900", delivered: "bg-emerald-200 text-emerald-950", completed: "bg-ink text-white", cancelled: "bg-rose-100 text-rose-900", failed: "bg-rose-100 text-rose-900",
  not_started: "bg-bone-2 text-ink-2", pending: "bg-bone-2 text-ink-2", assigned: "bg-sky-100 text-sky-900",
  active: "bg-emerald-100 text-emerald-900", paused: "bg-amber-100 text-amber-900", churned: "bg-rose-100 text-rose-900", expired: "bg-rose-100 text-rose-900", lead: "bg-bone-2 text-ink-2", onboarding: "bg-sky-100 text-sky-900",
  draft: "bg-bone-2 text-ink-2", proposed: "bg-sky-100 text-sky-900", approved: "bg-emerald-100 text-emerald-900", ordered: "bg-ink text-white", archived: "bg-bone-2 text-ink-3",
  todo: "bg-bone-2 text-ink-2", in_progress: "bg-sky-100 text-sky-900", done: "bg-emerald-100 text-emerald-900", na: "bg-bone-2 text-ink-3",
  queued: "bg-amber-100 text-amber-900", sent: "bg-emerald-100 text-emerald-900", skipped: "bg-bone-2 text-ink-3",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_TONES[status] ?? "bg-bone-2 text-ink-2"}`}>{status.replace(/_/g, " ")}</span>;
}

const CAT: Record<string, string> = { breakfast: "bg-cat-breakfast", lunch: "bg-cat-lunch", dinner: "bg-cat-dinner", snack: "bg-cat-snack", dessert: "bg-cat-snack", drink: "bg-sage" };
export function CategoryDot({ category }: { category: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${CAT[category] ?? "bg-sage"}`} aria-hidden />;
}
export function CategoryBadge({ category }: { category: string }) {
  return <span className="badge bg-bone-2 text-ink-2"><CategoryDot category={category} />{category}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-ink-3 py-8 text-center">{children}</div>;
}

export function Progress({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "good" | "warn" | "ink" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const cls = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "ink" ? "bg-ink" : "bg-accent";
  return (
    <div className="h-1.5 w-full rounded-full bg-bone-2 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, kicker, children, actions }: { title: ReactNode; kicker?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {kicker && <div className="kicker mb-1">{kicker}</div>}
        <h1 className="text-3xl">{title}</h1>
        {children && <p className="text-sm text-ink-2 mt-1 max-w-2xl">{children}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs px-3 py-2 leading-relaxed">
      <strong>Guidance, not medical advice.</strong>{" "}
      {text ?? "Nutrition figures are estimates based on recognised equations and ingredient data. They do not diagnose conditions or replace a registered dietitian or doctor."}
    </div>
  );
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string }[]; active: string; base: string }) {
  return (
    <nav className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}${t.key === tabs[0].key ? "" : `?tab=${t.key}`}`} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${active === t.key ? "border-accent text-ink font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function NutritionRow({ n, compact = false }: { n: { kcal: number; protein: number; carbs: number; fat: number; fibre: number }; compact?: boolean }) {
  const cls = compact ? "text-[11px] text-ink-2" : "text-xs text-ink-2";
  return (
    <div className={`flex gap-3 ${cls}`}>
      <span><b className="text-ink">{Math.round(n.kcal)}</b> kcal</span>
      <span><b className="text-ink">{Math.round(n.protein)}</b>g P</span>
      <span><b className="text-ink">{Math.round(n.carbs)}</b>g C</span>
      <span><b className="text-ink">{Math.round(n.fat)}</b>g F</span>
      <span><b className="text-ink">{Math.round(n.fibre)}</b>g fibre</span>
    </div>
  );
}

export function Rating({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-ink-3 text-xs">—</span>;
  return <span className="text-xs"><span className="text-amber-500">★</span> {value.toFixed(1)}</span>;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${d.getDate()} ${M[d.getMonth()]}`;
  if (iso.length <= 10) return `${date} ${d.getFullYear()}`;
  return `${date} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
