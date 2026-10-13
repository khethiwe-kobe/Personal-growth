import type { ChatContent, ChatPart } from "../types";

const hasCall = (c: ChatContent) => c.parts.some((p) => p.functionCall);
const hasResponse = (c: ChatContent) => c.parts.some((p) => p.functionResponse);

function mergeRoles(h: ChatContent[]): ChatContent[] {
  const out: ChatContent[] = [];
  for (const c of h) {
    if (!c.parts.length) continue;
    const last = out[out.length - 1];
    if (last && last.role === c.role) out[out.length - 1] = { role: c.role, parts: [...last.parts, ...c.parts] };
    else out.push({ role: c.role, parts: [...c.parts] });
  }
  return out;
}

/**
 * Make a transcript valid to send: alternate roles, start with the user, and
 * never leave a function call without its response (or the reverse).
 */
export function sanitizeHistory(history: ChatContent[]): ChatContent[] {
  let h = mergeRoles(history);
  h = h.map((c, i) => {
    if (c.role === "model" && hasCall(c) && !(h[i + 1]?.role === "user" && hasResponse(h[i + 1]))) {
      return { ...c, parts: c.parts.filter((p) => !p.functionCall) };
    }
    if (c.role === "user" && hasResponse(c) && !(h[i - 1]?.role === "model" && hasCall(h[i - 1]))) {
      return { ...c, parts: c.parts.filter((p) => !p.functionResponse) };
    }
    return c;
  });
  h = mergeRoles(h);
  while (h.length && h[0].role !== "user") h.shift();
  return h;
}

type Legacy = { role?: unknown; content?: unknown; parts?: unknown };

/**
 * Read a stored transcript. The first version of the app stored turns in a
 * different shape (role "assistant", content blocks); those keep their text.
 */
export function normalizeHistory(raw: unknown): ChatContent[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatContent[] = [];
  for (const m of raw as Legacy[]) {
    if (!m || typeof m !== "object") continue;
    if ((m.role === "user" || m.role === "model") && Array.isArray(m.parts)) {
      out.push({ role: m.role, parts: m.parts as ChatPart[] });
      continue;
    }
    if (m.role === "user" || m.role === "assistant") {
      const parts: ChatPart[] = [];
      if (typeof m.content === "string") parts.push({ text: m.content });
      else if (Array.isArray(m.content)) {
        for (const b of m.content as { type?: string; text?: unknown }[]) {
          if (b?.type === "text" && typeof b.text === "string") parts.push({ text: b.text });
        }
      }
      if (!parts.length) continue;
      const role = m.role === "user" ? "user" : "model";
      // Separate coach messages that will merge once their tool rounds are dropped.
      const prev = out[out.length - 1];
      if (role === "model" && prev?.role === "model" && parts[0]?.text !== undefined) {
        parts[0] = { text: `\n\n${parts[0].text}` };
      }
      out.push({ role, parts });
    }
  }
  return sanitizeHistory(out);
}

/** Plain-text rendering of a transcript, used when asking for a summary. */
export function transcriptText(history: ChatContent[]): string {
  const lines: string[] = [];
  for (const c of history) {
    for (const p of c.parts) {
      if (p.thought) continue;
      if (p.text?.trim()) lines.push(`${c.role === "user" ? "Athlete" : "Coach"}: ${p.text.trim()}`);
      if (p.functionCall) lines.push(`[Coach saved ${p.functionCall.name}: ${JSON.stringify(p.functionCall.args ?? {})}]`);
    }
  }
  return lines.join("\n\n");
}
