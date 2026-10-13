import { createHash, timingSafeEqual } from "node:crypto";

/** The shared passcode for this deployment, or null when the app is open. */
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

/** A slow, uniform refusal so guessing passcodes is tedious. */
export async function passcodeDenied(): Promise<Response> {
  await new Promise((r) => setTimeout(r, 600));
  return Response.json({ error: "Enter the passcode to use the coach.", code: "passcode" }, { status: 401 });
}

export function geminiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k ? k : null;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
