/** Everyone in the group trains in Johannesburg time; days and weeks follow it. */
export const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Africa/Johannesburg";

/** YYYY-MM-DD for an instant in the group's time zone. */
export function dayOf(d: Date = new Date(), tz: string = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function longDate(d: Date = new Date(), tz: string = TZ): string {
  return d.toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Calendar arithmetic on YYYY-MM-DD strings (time-zone free). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function weekdayName(day: string): string {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][weekdayIndex(day)];
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** "3 h ago", "yesterday", "12 Oct" — short relative labels for the feed. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.round((Date.parse(dayOf(now)) - Date.parse(dayOf(new Date(iso)))) / 86400000);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
}
