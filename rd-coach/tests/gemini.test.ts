import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@google/genai";
import { friendlyError, modelChain, withFallback } from "../lib/server/gemini";

test("model chain puts the primary first and drops duplicates", () => {
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODELS;
  assert.deepEqual(modelChain(), ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);
  process.env.GEMINI_MODEL = "gemini-3.6-flash";
  process.env.GEMINI_FALLBACK_MODELS = "gemini-3.6-flash, gemini-3.5-flash-lite ,";
  assert.deepEqual(modelChain(), ["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODELS;
});

test("overloaded models fall through to the next one", async () => {
  const tried: string[] = [];
  const out = await withFallback(async (m) => {
    tried.push(m);
    if (m === "gemini-3.8-flash") throw new ApiError({ message: "high demand", status: 503 });
    return `ok:${m}`;
  });
  assert.equal(out, "ok:gemini-3.6-flash");
  assert.deepEqual(tried, ["gemini-3.8-flash", "gemini-3.6-flash"]);
});

test("other errors stop immediately", async () => {
  const tried: string[] = [];
  await assert.rejects(
    withFallback(async (m) => {
      tried.push(m);
      throw new ApiError({ message: "bad key", status: 400 });
    }),
  );
  assert.equal(tried.length, 1);
});

test("when every model is overloaded the last error surfaces", async () => {
  await assert.rejects(
    withFallback(async () => {
      throw new ApiError({ message: "busy", status: 503 });
    }),
    (e: unknown) => e instanceof ApiError && e.status === 503,
  );
});

test("errors are explained in plain language, never raw JSON", () => {
  const busy = friendlyError(new ApiError({ message: '{"error":{"code":503}}', status: 503 }));
  assert.match(busy, /busy/);
  assert.ok(!busy.includes("{"));
  assert.match(friendlyError(new ApiError({ message: "x", status: 429 })), /usage limit/);
  assert.match(friendlyError(new ApiError({ message: "x", status: 403 })), /key/);
});
