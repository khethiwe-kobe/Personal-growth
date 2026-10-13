import { dayOf } from "./time";

/**
 * RD is one date for the whole JHB group. NEXT_PUBLIC_RD_DATE (YYYY-MM-DD)
 * overrides it without a code change; it is read at build time, so redeploy
 * after changing it.
 */
export const RD_DATE = (process.env.NEXT_PUBLIC_RD_DATE || "2026-11-30").trim();

/** Whole days from `today` to RD (negative once RD has passed). */
export function daysToRd(today: string = dayOf()): number {
  return Math.round((Date.parse(RD_DATE) - Date.parse(today)) / 86_400_000);
}

export function rdLongDate(): string {
  const [y, m, d] = RD_DATE.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "48 days to RD", "RD is tomorrow", "RD day", "RD was 3 days ago". */
export function rdCountdown(today: string = dayOf()): string {
  const n = daysToRd(today);
  if (n > 1) return `${n} days to RD`;
  if (n === 1) return "RD is tomorrow";
  if (n === 0) return "RD is today";
  return `RD was ${-n} day${n === -1 ? "" : "s"} ago`;
}

/** The sentence the coach reads at the top of every message. */
export function rdContext(today: string = dayOf()): string {
  const n = daysToRd(today);
  if (n < 0) return `RD took place on ${rdLongDate()} (${RD_DATE}), ${-n} days ago.`;
  const weeks = Math.floor(n / 7);
  const days = n % 7;
  const span = [weeks ? `${weeks} week${weeks === 1 ? "" : "s"}` : "", days ? `${days} day${days === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(" and ");
  return `RD is on ${rdLongDate()} (${RD_DATE}): ${n === 0 ? "today" : `${n} days away (${span})`}. This date is fixed for the whole group.`;
}
