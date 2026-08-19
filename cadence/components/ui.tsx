import Link from "next/link";

export function Card({
  children, className = "", pad = true,
}: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface ${pad ? "p-5" : ""} ${className}`}
      style={{ boxShadow: "var(--shadow)" }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  children, action,
}: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between first:mt-0">
      <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-3">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageTitle({
  title, subtitle, action,
}: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] font-medium leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children, variant = "primary", type = "submit", className = "", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
}) {
  const styles = {
    primary:
      "bg-ink text-bg hover:opacity-85 active:scale-[0.98] border border-transparent",
    soft:
      "bg-accent-soft text-accent-ink hover:brightness-97 active:scale-[0.98] border border-transparent dark:hover:brightness-110",
    ghost:
      "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink border border-line",
    danger:
      "bg-transparent text-danger hover:bg-danger-soft border border-line",
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium disabled:opacity-40 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href, children, variant = "ghost", className = "",
}: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" | "soft"; className?: string }) {
  const styles = {
    primary: "bg-ink text-bg hover:opacity-85 border border-transparent",
    soft: "bg-accent-soft text-accent-ink border border-transparent",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink border border-line",
  }[variant];
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Chip({
  color, children, className = "",
}: { color?: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2 ${className}`}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {children}
    </span>
  );
}

export function PriorityBadge({ p }: { p: "A" | "B" | "C" }) {
  const style = {
    A: "text-danger border-danger/30",
    B: "text-warn border-warn/30",
    C: "text-ink-3 border-line-2",
  }[p];
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border bg-transparent text-[11px] font-semibold ${style}`}
      title={{ A: "Critical — must do", B: "Important", C: "Nice to do" }[p]}
    >
      {p}
    </span>
  );
}

export function ProgressBar({
  pct, color, className = "", height = 6,
}: { pct: number; color?: string; className?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ background: "var(--ring-track)", height }}
      role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: color ?? "var(--accent)" }}
      />
    </div>
  );
}

export function Ring({
  pct, size = 92, stroke = 7, color, label, sub,
}: {
  pct: number; size?: number; stroke?: number; color?: string;
  label?: React.ReactNode; sub?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamped / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color ?? "var(--accent)"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          className="ring-anim"
          style={{ ["--ring-c" as string]: c }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-lg font-semibold leading-none">{label ?? `${Math.round(clamped)}%`}</div>
        {sub && <div className="mt-0.5 text-[10px] text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}

export function Stat({
  label, value, sub, className = "",
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  title, hint, action,
}: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-ink-3">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Trend({ delta, suffix = "%" }: { delta: number; suffix?: string }) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.5)
    return <span className="text-xs text-ink-3">steady</span>;
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-ok" : "text-danger"}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {up ? <path d="M4 16l6-6 4 4 6-8" /> : <path d="M4 8l6 6 4-4 6 8" />}
      </svg>
      {up ? "+" : ""}{Math.round(delta)}{suffix}
    </span>
  );
}
