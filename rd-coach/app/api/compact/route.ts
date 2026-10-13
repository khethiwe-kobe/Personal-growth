import Anthropic from "@anthropic-ai/sdk";
import { COACH_SYSTEM_PROMPT, COMPACT_PROMPT } from "@/lib/coach/system";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.COACH_MODEL || "claude-opus-5-5";

/** Simple client-side compaction: the whole transcript becomes one summary. */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY || req.headers.get("x-coach-key") || undefined;
  if (!apiKey) return Response.json({ error: "No API key." }, { status: 401 });

  let history: Anthropic.MessageParam[];
  try {
    const body = (await req.json()) as { history?: Anthropic.MessageParam[] };
    history = Array.isArray(body.history) ? body.history : [];
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (history.length === 0) return Response.json({ summary: "" });

  // Thinking blocks are bound to the conversation they came from; the summary
  // request is a different conversation, so only text and tool blocks are sent.
  const stripped: Anthropic.MessageParam[] = history.map((m) => {
    if (typeof m.content === "string") return m;
    return {
      role: m.role,
      content: m.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking"),
    } as Anthropic.MessageParam;
  });
  if (stripped[stripped.length - 1].role !== "user") {
    stripped.push({ role: "user", content: COMPACT_PROMPT });
  } else {
    stripped.push({ role: "assistant", content: "Understood." }, { role: "user", content: COMPACT_PROMPT });
  }

  const client = new Anthropic({ apiKey });
  try {
    const s = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: COACH_SYSTEM_PROMPT,
      messages: stripped as Anthropic.Beta.BetaMessageParam[],
    });
    const message = await s.finalMessage();
    if (message.stop_reason === "refusal") {
      return Response.json({ error: "Could not summarise this conversation." }, { status: 422 });
    }
    const summary = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return Response.json({ summary });
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : "Failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
