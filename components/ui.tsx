"use client";

import { ReactNode, useEffect } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="rise mb-8">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">{subtitle}</p>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-xl text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wider text-faint">{children}</span>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet" };

export function Button({ variant = "primary", className = "", ...props }: BtnProps) {
  const styles =
    variant === "primary"
      ? "bg-brown text-white hover:bg-brown-deep"
      : variant === "ghost"
        ? "border border-line bg-card text-soft hover:border-brown-faint hover:text-ink"
        : "text-soft hover:text-ink";
  return (
    <button
      className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

const fieldStyles =
  "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-faint/70 focus:border-brown-soft focus:outline-none transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldStyles} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${fieldStyles} leading-relaxed ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldStyles} ${props.className ?? ""}`} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-faint">{label}</span>
      {children}
    </label>
  );
}

/** Square check control — a filled square when on, empty when off (no icon glyphs). */
export function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="group flex items-center gap-2 text-left"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors duration-200 ${
          checked ? "border-brown bg-brown" : "border-line bg-card group-hover:border-brown-faint"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-sm bg-white transition-transform duration-200 ${checked ? "scale-100" : "scale-0"}`}
        />
      </span>
      {label && <span className={`text-sm ${checked ? "text-ink" : "text-soft"}`}>{label}</span>}
    </button>
  );
}

export function Tag({ children, tone = "beige" }: { children: ReactNode; tone?: "beige" | "brown" | "sage" }) {
  const styles =
    tone === "brown"
      ? "bg-brown text-white"
      : tone === "sage"
        ? "bg-[#eef0e9] text-[#4d573f]"
        : "bg-beige text-brown-deep";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${styles}`}>{children}</span>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-beige ${className}`}>
      <div
        className="h-full rounded-full bg-brown transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-soft">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/50 px-6 py-10 text-center">
      <p className="text-sm text-soft">{title}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fadein fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-display text-2xl text-ink">{title}</h3>
          <Button variant="quiet" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
            active === t.id ? "bg-brown text-white" : "border border-line bg-card text-soft hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
