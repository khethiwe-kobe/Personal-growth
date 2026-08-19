"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { monthLabel, shiftMonth } from "@/lib/format";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "bg-accent text-accent-ink hover:opacity-90",
        variant === "ghost" &&
          "border border-border bg-transparent text-ink hover:bg-surface-2",
        variant === "subtle" && "bg-surface-2 text-ink hover:opacity-80",
        variant === "danger" &&
          "border border-border bg-transparent text-bad hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none",
        className,
      )}
      rows={3}
      {...rest}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-border bg-surface p-5", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "good" | "bad" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs font-medium tracking-wide text-muted">{label}</div>
      <div
        className={cx(
          "mt-1.5 text-xl font-semibold tracking-tight tabular-nums",
          tone === "good" && "text-good",
          tone === "bad" && "text-bad",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "border-border bg-surface-2 text-muted",
        tone === "good" && "border-transparent bg-good/15 text-good",
        tone === "warn" && "border-transparent bg-warn/15 text-warn",
        tone === "bad" && "border-transparent bg-bad/15 text-bad",
        tone === "accent" && "border-transparent bg-accent/15 text-accent",
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MonthNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (ym: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(value, -1))}
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
      >
        &#8249;
      </button>
      <span className="min-w-36 px-2 text-center text-sm font-semibold">
        {monthLabel(value)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(value, 1))}
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
      >
        &#8250;
      </button>
    </div>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 sm:pt-20"
      onMouseDown={(e) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={ref}
        className={cx(
          "w-full rounded-xl border border-border bg-surface p-6 shadow-xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PersonDot({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block h-2 w-2 rounded-full",
        index === 0 ? "bg-series-1" : "bg-series-2",
      )}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}
