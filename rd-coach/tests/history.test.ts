import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHistory, sanitizeHistory, transcriptText } from "../lib/coach/history";
import type { ChatContent } from "../lib/types";

test("legacy transcripts keep their text and lose tool and thinking blocks", () => {
  const legacy = [
    { role: "user", content: [{ type: "text", text: "<context>x</context>" }, { type: "text", text: "Ready." }] },
    { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "First questions." }, { type: "tool_use", id: "t", name: "set_phase", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "Saved." }] },
    { role: "assistant", content: [{ type: "text", text: "Age?" }] },
  ];
  const h = normalizeHistory(legacy);
  assert.deepEqual(h, [
    { role: "user", parts: [{ text: "<context>x</context>" }, { text: "Ready." }] },
    { role: "model", parts: [{ text: "First questions." }, { text: "\n\nAge?" }] },
  ]);
});

test("current transcripts pass through unchanged, signatures included", () => {
  const h: ChatContent[] = [
    { role: "user", parts: [{ text: "hi" }] },
    { role: "model", parts: [{ text: "Saving.", thoughtSignature: "abc" }, { functionCall: { id: "1", name: "set_phase", args: { phase: "analysis" } }, thoughtSignature: "def" }] },
    { role: "user", parts: [{ functionResponse: { id: "1", name: "set_phase", response: { result: "Saved." } } }] },
    { role: "model", parts: [{ text: "Done." }] },
  ];
  assert.deepEqual(normalizeHistory(h), h);
});

test("orphan function calls and responses are removed", () => {
  const h = sanitizeHistory([
    { role: "user", parts: [{ text: "hi" }] },
    { role: "model", parts: [{ text: "Saving." }, { functionCall: { name: "set_phase", args: {} } }] },
    { role: "user", parts: [{ text: "next" }] },
  ]);
  assert.deepEqual(h, [
    { role: "user", parts: [{ text: "hi" }] },
    { role: "model", parts: [{ text: "Saving." }] },
    { role: "user", parts: [{ text: "next" }] },
  ]);
});

test("a transcript never starts with the model and same roles are merged", () => {
  const h = sanitizeHistory([
    { role: "model", parts: [{ text: "stray" }] },
    { role: "user", parts: [{ text: "a" }] },
    { role: "user", parts: [{ text: "b" }] },
  ]);
  assert.deepEqual(h, [{ role: "user", parts: [{ text: "a" }, { text: "b" }] }]);
});

test("transcript text includes saves for the summariser", () => {
  const t = transcriptText([
    { role: "user", parts: [{ text: "28 years old" }] },
    { role: "model", parts: [{ text: "Noted." }, { functionCall: { name: "update_profile", args: { fields: [{ key: "age", value: "28" }] } } }] },
  ]);
  assert.match(t, /Athlete: 28 years old/);
  assert.match(t, /\[Coach saved update_profile: .*"age"/);
});
