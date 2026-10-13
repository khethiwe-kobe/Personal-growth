import { createHash, timingSafeEqual } from "node:crypto";

/** The JHB group's join code (COACH_PASSCODE), or null when none is configured. */
function expected(): string | null {
  const v = process.env.COACH_PASSCODE?.trim();
  return v ? v : null;
}

export function passcodeRequired(): boolean {
  return expected() !== null;
}

export function passcodeValid(given: unknown): boolean {
  const want = expected();
  if (!want) return true;
  if (typeof given !== "string" || !given.trim()) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

export function geminiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k ? k : null;
}
