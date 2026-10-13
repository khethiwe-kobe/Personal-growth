import { test } from "node:test";
import assert from "node:assert/strict";
import { COACH_TOOLS, TOOL_SCHEMAS } from "../lib/coach/tools";

test("every tool definition has a validation schema and vice versa", () => {
  const names = COACH_TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, Object.keys(TOOL_SCHEMAS).sort());
});

test("tool JSON schemas reject unknown properties so inputs stay strict", () => {
  for (const t of COACH_TOOLS) {
    assert.equal((t.parametersJsonSchema as { additionalProperties?: boolean }).additionalProperties, false, t.name);
  }
});

test("schemas avoid JSON Schema features Gemini rejects", () => {
  const text = JSON.stringify(COACH_TOOLS);
  assert.ok(!text.includes('"type":['), "no union types");
  assert.ok(!/"additionalProperties":\{/.test(text), "no open maps");
});
