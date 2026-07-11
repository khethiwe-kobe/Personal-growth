import type { BibleProgress, ChapterActivity } from "./types";
import { addDays, daysBetween, fromISO, isSunday, lastNDays, monthKey, streakFrom, todayISO, toISO, weekStart } from "./dates";

export interface BibleBook {
  name: string;
  chapters: number;
  testament: "NT" | "OT";
}

// New Testament first — the plan reads it before the Old Testament.
export const NT_BOOKS: BibleBook[] = [
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
  ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6],
  ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5],
  ["2 Thessalonians", 3], ["1 Timothy", 6], ["2 Timothy", 4], ["Titus", 3],
  ["Philemon", 1], ["Hebrews", 13], ["James", 5], ["1 Peter", 5], ["2 Peter", 3],
  ["1 John", 5], ["2 John", 1], ["3 John", 1], ["Jude", 1], ["Revelation", 22],
].map(([name, chapters]) => ({ name: name as string, chapters: chapters as number, testament: "NT" as const }));

export const OT_BOOKS: BibleBook[] = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
  ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36],
  ["Ezra", 10], ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150],
  ["Proverbs", 31], ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66],
  ["Jeremiah", 52], ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14],
  ["Joel", 3], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3],
  ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
].map(([name, chapters]) => ({ name: name as string, chapters: chapters as number, testament: "OT" as const }));

export const ALL_BOOKS: BibleBook[] = [...NT_BOOKS, ...OT_BOOKS];

/** Canonical plan order: every chapter id ("John 3"), NT first then OT. */
export const PLAN_ORDER: string[] = ALL_BOOKS.flatMap((b) =>
  Array.from({ length: b.chapters }, (_, i) => `${b.name} ${i + 1}`)
);

export const TOTAL_CHAPTERS = PLAN_ORDER.length; // 1189
export const NT_CHAPTERS = NT_BOOKS.reduce((s, b) => s + b.chapters, 0); // 260

export function isChapterDone(a?: ChapterActivity): boolean {
  return !!(a && (a.read || a.listened || a.studied));
}

/** 30 November deadline — this year if still ahead, otherwise next year. */
export function planDeadline(today = todayISO()): string {
  const year = fromISO(today).getFullYear();
  const target = `${year}-11-30`;
  return today <= target ? target : `${year + 1}-11-30`;
}

/** Sundays carry half a day's weight (church morning and evening). */
function dayWeight(iso: string): number {
  return isSunday(iso) ? 0.5 : 1;
}

export function remainingChapters(progress: BibleProgress): string[] {
  return PLAN_ORDER.filter((id) => !isChapterDone(progress[id]));
}

/**
 * Today's reading, recomputed daily from what is actually finished — so the
 * plan self-adjusts when you fall behind, and shrinks when you jump ahead.
 */
export function todaysReading(progress: BibleProgress, today = todayISO()): string[] {
  const remaining = remainingChapters(progress);
  if (remaining.length === 0) return [];
  const deadline = planDeadline(today);
  if (today >= deadline) return remaining.slice(0, Math.min(remaining.length, 12));
  let totalWeight = 0;
  for (let d = today; d <= deadline; d = addDays(d, 1)) totalWeight += dayWeight(d);
  const n = Math.max(1, Math.ceil((remaining.length * dayWeight(today)) / totalWeight));
  return remaining.slice(0, Math.min(n, remaining.length));
}

export interface BibleStats {
  completed: number;
  total: number;
  pct: number;
  ntCompleted: number;
  daysRemaining: number;
  deadline: string;
  onTrack: boolean;
  /** chapters/day needed from today to hit the deadline (weekday pace) */
  paceNeeded: number;
  /** average chapters/day over the last 14 active days */
  recentPace: number;
  estimatedFinish: string | null;
  streak: number;
  thisWeek: number;
  thisMonth: number;
  perDay: Record<string, number>;
}

export function bibleStats(progress: BibleProgress, today = todayISO()): BibleStats {
  const perDay: Record<string, number> = {};
  let completed = 0;
  for (const id of PLAN_ORDER) {
    const a = progress[id];
    if (isChapterDone(a)) {
      completed++;
      if (a?.date) perDay[a.date] = (perDay[a.date] || 0) + 1;
    }
  }
  // NT chapters are the first NT_CHAPTERS entries of PLAN_ORDER
  const ntCompleted = PLAN_ORDER.slice(0, NT_CHAPTERS).filter((id) => isChapterDone(progress[id])).length;

  const deadline = planDeadline(today);
  const daysRemaining = Math.max(0, daysBetween(today, deadline));
  const remaining = TOTAL_CHAPTERS - completed;

  let totalWeight = 0;
  for (let d = today; d <= deadline; d = addDays(d, 1)) totalWeight += dayWeight(d);
  const paceNeeded = totalWeight > 0 ? remaining / totalWeight : remaining;

  const recentDays = lastNDays(14, today);
  const recentTotal = recentDays.reduce((s, d) => s + (perDay[d] || 0), 0);
  const recentPace = recentTotal / 14;

  let estimatedFinish: string | null = null;
  if (remaining === 0) {
    estimatedFinish = today;
  } else if (recentPace > 0.1) {
    estimatedFinish = addDays(today, Math.ceil(remaining / recentPace));
  }

  const ws = weekStart(today);
  let thisWeek = 0;
  for (let d = ws; d <= today; d = addDays(d, 1)) thisWeek += perDay[d] || 0;
  const mk = monthKey(today);
  const thisMonth = Object.entries(perDay)
    .filter(([d]) => d.startsWith(mk))
    .reduce((s, [, n]) => s + n, 0);

  return {
    completed,
    total: TOTAL_CHAPTERS,
    pct: Math.round((completed / TOTAL_CHAPTERS) * 100),
    ntCompleted,
    daysRemaining,
    deadline,
    onTrack: estimatedFinish !== null && estimatedFinish <= deadline,
    paceNeeded,
    recentPace,
    estimatedFinish,
    streak: streakFrom(new Set(Object.keys(perDay))),
    thisWeek,
    thisMonth,
    perDay,
  };
}

/** Reading-time estimate used on the analytics page (avg minutes per chapter). */
export const MINUTES_PER_CHAPTER = 4;

export { toISO };
