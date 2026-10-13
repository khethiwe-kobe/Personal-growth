import { ApiError, GoogleGenAI } from "@google/genai";

/** Primary model first, then fallbacks for when it is overloaded or out of quota. */
export function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return Array.from(new Set([primary, ...fallbacks]));
}

/** Overload and quota errors are worth trying on another model. */
export function shouldFallBack(err: unknown): boolean {
  return err instanceof ApiError && [429, 500, 502, 503, 504].includes(err.status);
}

export function client(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    // Brief retries for momentary overloads; longer outages fall through to the next model.
    httpOptions: { retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, httpStatusCodes: [500, 502, 503, 504] } },
  });
}

/** Run `call` on each model in turn until one is available. */
export async function withFallback<T>(call: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of modelChain()) {
    try {
      return await call(model);
    } catch (err) {
      if (!shouldFallBack(err)) throw err;
      last = err;
    }
  }
  throw last;
}

/** A short, plain message for the athlete instead of the raw API error. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503 || err.status === 500 || err.status === 502 || err.status === 504) {
      return "Google's Gemini servers are busy right now. Wait a minute and send your message again.";
    }
    if (err.status === 429) {
      return "The coach has reached its usage limit for now. Try again in a few minutes, or later today if it keeps happening.";
    }
    if (err.status === 400 || err.status === 401 || err.status === 403) {
      return "The AI service rejected the request. The app's Gemini key may be missing, wrong or not yet active.";
    }
    return `The AI service returned an error (${err.status}). Please try again.`;
  }
  return err instanceof Error ? err.message : "Something went wrong talking to the coach.";
}

/** Errors that a later attempt is likely to get past. */
export function isTransient(err: unknown): boolean {
  return shouldFallBack(err) || (err instanceof Error && /fetch failed|ECONNRESET|socket hang up|network/i.test(err.message));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Keep trying through busy periods instead of failing straight away: every
 * attempt already retries and falls back across models, and between attempts
 * we wait a little longer each time.
 */
export async function withPatience<T>(
  attempt: () => Promise<T>,
  onWait: (attemptNo: number) => void,
  waitsSeconds: number[] = [5, 10, 20],
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (!isTransient(err) || i >= waitsSeconds.length) throw err;
      onWait(i + 1);
      await sleep(waitsSeconds[i] * 1000);
    }
  }
}
