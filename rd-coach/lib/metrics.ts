import type { Metric } from "./types";

/** Timed efforts over a distance improve when the number goes down. */
export function lowerIsBetter(m: Pick<Metric, "unit" | "key" | "label">): boolean {
  const timed = /^(s|sec|secs|seconds|min|mins|minutes|h|hours)$/i.test(m.unit.trim());
  const effort = /run|row|swim|sprint|march|ruck|walk|mile|km|time trial|shuttle|cycle|bike/i.test(`${m.key} ${m.label}`);
  return timed && effort;
}

/** True when `next` beats `best` for this test. */
export function beats(m: Pick<Metric, "unit" | "key" | "label">, next: number, best: number): boolean {
  return lowerIsBetter(m) ? next < best : next > best;
}

/** Readings grouped by test, oldest first. */
export function groupMetrics(metrics: Metric[]): Metric[][] {
  const map = new Map<string, Metric[]>();
  for (const m of metrics) {
    const arr = map.get(m.key) ?? [];
    arr.push(m);
    map.set(m.key, arr);
  }
  return Array.from(map.values()).map((arr) => [...arr].sort((a, b) => a.date.localeCompare(b.date)));
}

/** Direction-aware % improvement from first to latest reading (positive = better). */
export function improvementPct(readings: Metric[]): number | null {
  if (readings.length < 2) return null;
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first.value === 0) return null;
  const raw = ((last.value - first.value) / Math.abs(first.value)) * 100;
  return lowerIsBetter(last) ? -raw : raw;
}
