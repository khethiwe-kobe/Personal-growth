import { test } from "node:test";
import assert from "node:assert/strict";
import { passcodeRequired, passcodeValid } from "../lib/server/auth";

test("no passcode configured means the app is open", () => {
  delete process.env.COACH_PASSCODE;
  assert.equal(passcodeRequired(), false);
  assert.equal(passcodeValid(undefined), true);
});

test("a configured passcode must match, ignoring surrounding spaces", () => {
  process.env.COACH_PASSCODE = "  iron-will-2026 ";
  assert.equal(passcodeRequired(), true);
  assert.equal(passcodeValid("iron-will-2026"), true);
  assert.equal(passcodeValid(" iron-will-2026\n"), true);
  assert.equal(passcodeValid("iron-will"), false);
  assert.equal(passcodeValid(""), false);
  assert.equal(passcodeValid(42), false);
  delete process.env.COACH_PASSCODE;
});
