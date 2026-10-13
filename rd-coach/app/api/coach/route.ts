import Anthropic from "@anthropic-ai/sdk";
import { COACH_SYSTEM_PROMPT } from "@/lib/coach/system";
import { COACH_TOOLS, TOOL_SCHEMAS, isToolName } from "@/lib/coach/tools";
import type { CoachEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.COACH_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

function resolveKey(req: Request): string | undefined {
  return process.env.ANTHROPIC_API_KEY || req.headers.get("x-coach-key") || undefined;
}

export async function POST(req: Request) {
  const apiKey = resolveKey(req);
  if (!apiKey) {
    return Response.json(
      { error: "No API key. Set ANTHROPIC_API_KEY on the server or add a key in Settings." },
      { status: 401 },
    );
  }

  let history: Anthropic.MessageParam[];
  try {
    const body = (await req.json()) as { history?: Anthropic.MessageParam[] };
    history = Array.isArray(body.history) ? body.history : [];
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "The transcript must end with a user turn." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CoachEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const messages: Anthropic.MessageParam[] = [...history];
      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 64000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [{ type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            tools: COACH_TOOLS as unknown as Anthropic.Beta.BetaToolUnion[],
            messages: messages as Anthropic.Beta.BetaMessageParam[],
          });
          s.on("text", (delta) => send({ type: "text", text: delta }));

          const message = await s.finalMessage();

          if (message.stop_reason === "refusal") {
            send({ type: "error", message: "The coach declined to answer that. Try rephrasing." });
            send({ type: "done", stop: "refusal" });
            return;
          }

          const toolUses = message.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );

          if (message.stop_reason === "max_tokens" && toolUses.length > 0) {
            send({ type: "error", message: "The response was cut off before saving. Please send that again." });
            send({ type: "done", stop: "max_tokens" });
            return;
          }

          // The assistant turn is stored verbatim (thinking blocks included) so
          // the transcript the browser keeps stays append-only.
          send({ type: "assistant", content: message.content as unknown as Anthropic.MessageParam["content"] });
          messages.push({ role: "assistant", content: message.content as unknown as Anthropic.MessageParam["content"] });

          if (toolUses.length === 0 || message.stop_reason !== "tool_use") {
            send({ type: "done", stop: message.stop_reason ?? "end_turn" });
            return;
          }

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const t of toolUses) {
            if (!isToolName(t.name)) {
              results.push({ type: "tool_result", tool_use_id: t.id, is_error: true, content: "Unknown tool." });
              continue;
            }
            const parsed = TOOL_SCHEMAS[t.name].safeParse(t.input);
            if (!parsed.success) {
              results.push({
                type: "tool_result",
                tool_use_id: t.id,
                is_error: true,
                content: JSON.stringify({ INVALID_JSON: parsed.error.issues.map((i) => i.message).join("; ") }),
              });
              continue;
            }
            send({ type: "tool", name: t.name, input: parsed.data });
            results.push({ type: "tool_result", tool_use_id: t.id, content: "Saved." });
          }
          send({ type: "tool_results", content: results });
          messages.push({ role: "user", content: results });
        }
        send({ type: "error", message: "Too many tool rounds; stopping." });
        send({ type: "done", stop: "tool_limit" });
      } catch (err) {
        let message = "Something went wrong talking to the coach.";
        if (err instanceof Anthropic.AuthenticationError) message = "The API key was rejected.";
        else if (err instanceof Anthropic.RateLimitError) message = "Rate limited. Wait a moment and try again.";
        else if (err instanceof Anthropic.BadRequestError) message = `Bad request: ${err.message}`;
        else if (err instanceof Anthropic.APIError) message = `API error ${err.status}: ${err.message}`;
        else if (err instanceof Error) message = err.message;
        send({ type: "error", message });
        send({ type: "done", stop: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
