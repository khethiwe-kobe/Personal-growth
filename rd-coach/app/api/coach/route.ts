import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { sanitizeHistory } from "@/lib/coach/history";
import { COACH_SYSTEM_PROMPT } from "@/lib/coach/system";
import { COACH_TOOLS, TOOL_SCHEMAS, isToolName } from "@/lib/coach/tools";
import { GEMINI_MODEL, geminiKey, passcodeDenied, passcodeValid } from "@/lib/server/auth";
import type { ChatContent, ChatPart, CoachEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TOOL_ROUNDS = 8;

/** Append a streamed part, joining plain text pieces so the stored turn stays compact. */
function appendPart(parts: ChatPart[], part: ChatPart) {
  const isText = typeof part.text === "string" && !part.functionCall && !part.functionResponse;
  if (isText && !part.text && !part.thoughtSignature) return;
  const last = parts[parts.length - 1];
  if (
    isText &&
    !part.thoughtSignature &&
    last &&
    typeof last.text === "string" &&
    !last.functionCall &&
    !last.thoughtSignature &&
    Boolean(last.thought) === Boolean(part.thought)
  ) {
    last.text += part.text;
    return;
  }
  parts.push({ ...part });
}

function blockedMessage(reason: string | undefined): string {
  switch (reason) {
    case FinishReason.MALFORMED_FUNCTION_CALL:
      return "The coach tripped while saving your data. Please send that again.";
    case FinishReason.SAFETY:
    case FinishReason.PROHIBITED_CONTENT:
    case FinishReason.BLOCKLIST:
    case FinishReason.SPII:
      return "The coach's safety filter stopped that reply. Try rephrasing.";
    default:
      return "The coach stopped before finishing. Please send that again.";
  }
}

export async function POST(req: Request) {
  let body: { history?: unknown; passcode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!passcodeValid(body.passcode)) return passcodeDenied();

  const apiKey = geminiKey();
  if (!apiKey) {
    return Response.json({ error: "The server is missing GEMINI_API_KEY." }, { status: 500 });
  }

  const history = sanitizeHistory(Array.isArray(body.history) ? (body.history as ChatContent[]) : []);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "The transcript must end with your message." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CoachEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const contents: ChatContent[] = [...history];
      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const chunks = await ai.models.generateContentStream({
            model: GEMINI_MODEL,
            contents,
            config: {
              systemInstruction: COACH_SYSTEM_PROMPT,
              tools: [{ functionDeclarations: COACH_TOOLS }],
              automaticFunctionCalling: { disable: true },
            },
          });

          const parts: ChatPart[] = [];
          let finish: string | undefined;
          let blocked: string | undefined;
          for await (const chunk of chunks) {
            if (chunk.promptFeedback?.blockReason) blocked = String(chunk.promptFeedback.blockReason);
            const cand = chunk.candidates?.[0];
            if (cand?.finishReason) finish = cand.finishReason;
            for (const p of cand?.content?.parts ?? []) {
              const part = p as ChatPart;
              if (typeof part.text === "string" && part.text && !part.thought) send({ type: "text", text: part.text });
              appendPart(parts, part);
            }
          }

          if (blocked) {
            send({ type: "error", message: "The coach's safety filter blocked that message. Try rephrasing." });
            send({ type: "done", stop: "blocked" });
            return;
          }

          const calls = parts.filter((p) => p.functionCall);
          const finishedCleanly = finish === FinishReason.STOP || finish === FinishReason.MAX_TOKENS || finish === undefined;
          if (!finishedCleanly || (finish === FinishReason.MAX_TOKENS && calls.length > 0) || parts.length === 0) {
            send({ type: "error", message: parts.length === 0 && finishedCleanly ? "The coach returned an empty reply. Please send that again." : blockedMessage(finish) });
            send({ type: "done", stop: finish ?? "empty" });
            return;
          }

          // The model turn is stored exactly as received, thought signatures
          // included, so later requests can continue the same reasoning.
          send({ type: "model", parts });
          contents.push({ role: "model", parts });

          if (calls.length === 0) {
            send({ type: "done", stop: finish ?? "STOP" });
            return;
          }

          const responses: ChatPart[] = [];
          for (const c of calls) {
            const call = c.functionCall!;
            const name = call.name ?? "";
            const base = { ...(call.id ? { id: call.id } : {}), name };
            if (!isToolName(name)) {
              responses.push({ functionResponse: { ...base, response: { error: "Unknown tool." } } });
              continue;
            }
            const parsed = TOOL_SCHEMAS[name].safeParse(call.args ?? {});
            if (!parsed.success) {
              responses.push({
                functionResponse: { ...base, response: { error: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` } },
              });
              continue;
            }
            send({ type: "tool", name, input: parsed.data });
            responses.push({ functionResponse: { ...base, response: { result: "Saved." } } });
          }
          send({ type: "tool_responses", parts: responses });
          contents.push({ role: "user", parts: responses });
        }
        send({ type: "error", message: "The coach made too many saves in one reply; stopping." });
        send({ type: "done", stop: "tool_limit" });
      } catch (err) {
        let message = "Something went wrong talking to the coach.";
        if (err instanceof ApiError) {
          if (err.status === 429) message = "The coach is at its usage limit right now. Wait a minute and try again.";
          else if (err.status === 400 || err.status === 403) message = `The AI service rejected the request (${err.status}): ${err.message}`;
          else message = `AI service error ${err.status}: ${err.message}`;
        } else if (err instanceof Error) message = err.message;
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
