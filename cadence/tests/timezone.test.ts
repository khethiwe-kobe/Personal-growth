import { test } from "node:test";
import assert from "node:assert/strict";
import { todayInTz, safeTz, FALLBACK_TZ } from "../lib/time";

test("safeTz keeps valid IANA zones", () => {
  assert.equal(safeTz("Africa/Johannesburg"), "Africa/Johannesburg");
  assert.equal(safeTz("America/New_York"), "America/New_York");
  assert.equal(safeTz("UTC"), "UTC");
});

test("safeTz falls back for anything Intl would reject", () => {
  for (const bad of ["Africa/Not_A_Zone", "Mars/Olympus", "", "   ", "GMT+2:00", null, undefined])
    assert.equal(safeTz(bad as string), FALLBACK_TZ, `expected fallback for ${JSON.stringify(bad)}`);
});

test("todayInTz never throws on a bad stored zone", () => {
  assert.match(todayInTz("Africa/Not_A_Zone"), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayInTz("Africa/Not_A_Zone"), todayInTz(FALLBACK_TZ));
});

test("todayInTz still respects a real zone across the date line", () => {
  const t = new Date("2026-08-19T22:30:00Z");
  assert.equal(todayInTz("Pacific/Auckland", t), "2026-08-20");
  assert.equal(todayInTz("America/Los_Angeles", t), "2026-08-19");
});
