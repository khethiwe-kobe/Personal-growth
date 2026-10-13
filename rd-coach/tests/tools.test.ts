import { test } from "node:test";
import assert from "node:assert/strict";
import { COACH_TOOLS, TOOL_SCHEMAS } from "../lib/coach/tools";

test("every tool definition has a validation schema and vice versa", () => {
  const names = COACH_TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, Object.keys(TOOL_SCHEMAS).sort());
});

test("tool JSON schemas reject unknown properties so inputs stay strict", () => {
  for (const t of COACH_TOOLS) {
    assert.equal((t.input_schema as { additionalProperties?: boolean }).additionalProperties, false, t.name);
  }
});
