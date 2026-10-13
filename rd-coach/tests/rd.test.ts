import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUserTurn } from "../lib/coach/turn";
import { daysToRd, rdContext, rdCountdown, RD_DATE } from "../lib/rd";
import { EMPTY_STATE } from "../lib/types";

test("RD defaults to 30 November 2026", () => {
  assert.equal(RD_DATE, "2026-11-30");
});

test("countdown from 13 October is 48 days, or 6 weeks and 6 days", () => {
  assert.equal(daysToRd("2026-10-13"), 48);
  assert.equal(rdCountdown("2026-10-13"), "48 days to RD");
  assert.match(rdContext("2026-10-13"), /Monday, 30 November 2026|Monday 30 November 2026/);
  assert.match(rdContext("2026-10-13"), /48 days away \(6 weeks and 6 days\)/);
  assert.equal(rdCountdown("2026-11-29"), "RD is tomorrow");
  assert.equal(rdCountdown("2026-11-30"), "RD is today");
  assert.equal(rdCountdown("2026-12-02"), "RD was 2 days ago");
});

test("every message tells the coach the RD date", () => {
  const turn = buildUserTurn({ ...EMPTY_STATE }, "hi", { name: "Ama", today: "2026-10-13", longDate: "Tuesday 13 October 2026" });
  assert.match(turn.parts[0].text!, /RD is on .*30 November 2026 \(2026-11-30\): 48 days away/);
});
