// Date helpers. All "ISO date" strings are local-time YYYY-MM-DD.

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

export function isSunday(iso: string): boolean {
  return fromISO(iso).getDay() === 0;
}

/** Monday of the week containing the given date. */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function lastNDays(n: number, endISO = todayISO()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endISO, -i));
  return out;
}

export function formatLong(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatMonth(key: string): string {
  return fromISO(key + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function dayOfYear(iso: string): number {
  const d = fromISO(iso);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/** Consecutive-day streak ending today or yesterday, given a set of active dates. */
export function streakFrom(dates: Set<string>): number {
  let cursor = todayISO();
  if (!dates.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
