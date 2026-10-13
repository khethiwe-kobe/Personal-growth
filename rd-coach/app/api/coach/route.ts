import { FinishReason, type GoogleGenAI } from "@google/genai";
import { postsForSave } from "@/lib/coach/achievements";
import { applyTool } from "@/lib/coach/apply";
import { sanitizeHistory, transcriptText, trimIncompleteTail } from "@/lib/coach/history";
import { COACH_SYSTEM_PROMPT, COMPACT_PROMPT } from "@/lib/coach/system";
import { COACH_TOOLS, TOOL_SCHEMAS, isToolName } from "@/lib/coach/tools";
import { buildUserTurn } from "@/lib/coach/turn";
import { geminiKey } from "@/lib/server/auth";
import { newId } from "@/lib/server/db";
import { client, friendlyError, withFallback, withPatience } from "@/lib/server/gemini";
import { bad, readJson, withMember } from "@/lib/server/http";
import { insertPosts } from "@/lib/server/social";
import { loadState, saveState } from "@/lib/server/state";
import { dayOf, longDate } from "@/lib/time";
import type { ChatContent, ChatPart, CoachEvent, CoachState, PostDraft } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TOOL_ROUNDS = 8;
const COMPACT_AT_CHARS = 300_000;

/** True when the transcript ends with tool results the coach never replied to. */
function endsWithToolResults(history: ChatContent[]): boolean {
  const last = history[history.length - 1];
  return !!last && last.role === "user" && last.parts.some((p) => p.functionResponse) && !last.parts.some((p) => p.text);
}

/** A round that went wrong in a way worth retrying (a malformed or empty reply). */
class RetryRound extends Error {}

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

/** One line per model call in the server logs (Vercel: Logs tab), for diagnosing stalls. */
function logRound(info: Record<string, unknown>) {
  console.log(JSON.stringify({ evt: "coach_round", ...info }));
}

/** One model call, streamed. Throws RetryRound for replies worth asking for again. */
async function runRound(ai: GoogleGenAI, contents: ChatContent[], send: (e: CoachEvent) => void, tag: Record<string, unknown>): Promise<ChatPart[]> {
  const started = Date.now();
  let usedModel = "";
  const chunks = await withFallback((model) => {
    usedModel = model;
    return ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: COACH_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: COACH_TOOLS }],
        automaticFunctionCalling: { disable: true },
      },
    });
  });
  const parts: ChatPart[] = [];
  let finish: string | undefined;
  for await (const chunk of chunks) {
    if (chunk.promptFeedback?.blockReason) {
      throw new Error("The coach's safety filter blocked that message. Try rephrasing it.");
    }
    const cand = chunk.candidates?.[0];
    if (cand?.finishReason) finish = cand.finishReason;
    for (const p of cand?.content?.parts ?? []) {
      const part = p as ChatPart;
      if (typeof part.text === "string" && part.text && !part.thought) send({ type: "text", text: part.text });
      appendPart(parts, part);
    }
  }
  const calls = parts.filter((p) => p.functionCall);
  logRound({
    ...tag,
    model: usedModel,
    ms: Date.now() - started,
    finish: finish ?? null,
    textChars: parts.reduce((n, p) => n + (p.thought ? 0 : (p.text ?? "").length), 0),
    calls: calls.map((c) => c.functionCall?.name),
    signatures: parts.filter((p) => p.thoughtSignature).length,
  });
  if (finish === FinishReason.MALFORMED_FUNCTION_CALL) throw new RetryRound("The coach's reply came out garbled. Please send that again.");
  if (finish === FinishReason.MAX_TOKENS && calls.length) throw new RetryRound("The coach's reply was cut off. Please send that again.");
  if (finish && finish !== FinishReason.STOP && finish !== FinishReason.MAX_TOKENS) {
    throw new Error("The coach's safety filter stopped that reply. Try rephrasing it.");
  }
  if (!parts.some((p) => p.text?.trim() || p.functionCall)) throw new RetryRound("The coach did not answer that time. Please send that again.");
  return parts;
}

async function summarise(ai: GoogleGenAI, history: ChatContent[]): Promise<string> {
  const res = await withFallback((model) =>
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: `${COMPACT_PROMPT}\n\n<transcript>\n${transcriptText(history)}\n</transcript>` }] }],
      config: { systemInstruction: COACH_SYSTEM_PROMPT },
    }),
  );
  return (res.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

export async function POST(req: Request) {
  return withMember(req, async (member) => {
    const body = await readJson<{ text?: unknown; resume?: unknown }>(req);
    const resume = body?.resume === true;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text && !resume) return bad("Type a message first.");
    if (text.length > 8000) return bad("That message is too long.");
    const apiKey = geminiKey();
    if (!apiKey) return bad("The server is missing GEMINI_API_KEY.", 500);

    const stored = await loadState(member.id);
    const ai = client(apiKey);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // If the member closes the app mid-reply, keep working and saving; just stop streaming.
        const send = (e: CoachEvent) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
          } catch {
            // Stream already closed by the browser.
          }
        };
        let state: CoachState = stored.state;
        let committed = false;
        try {
          const today = dayOf();

          // Very long conversations are condensed into the coach's own notes first.
          if (JSON.stringify(state.history).length > COMPACT_AT_CHARS) {
            try {
              const summary = await summarise(ai, state.history);
              if (summary) {
                state = {
                  ...state,
                  history: [],
                  pendingSummary: [state.pendingSummary, summary].filter(Boolean).join("\n\n"),
                  stateVersion: state.stateVersion + 1,
                };
                await saveState(member.id, state);
              }
            } catch {
              // Not fatal: carry on with the full transcript.
            }
          }

          const dangling = endsWithToolResults(state.history);
          let turn: ChatContent | null = null;
          if (resume) {
            // Finish the reply that was cut off after the coach saved something.
            if (!dangling) {
              send({ type: "done", stop: "nothing_to_resume" });
              return;
            }
            committed = true;
          } else {
            if (dangling) {
              // A new message arrived instead: close the unfinished round off; the saves stay.
              state = { ...state, history: trimIncompleteTail(state.history), stateVersion: state.stateVersion + 1 };
            }
            turn = buildUserTurn(state, text, { name: member.name, today, longDate: longDate() });
          }
          let contents = sanitizeHistory(turn ? [...state.history, turn] : state.history);
          const tag = { member: member.id, resume };

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const parts = await withPatience(
              () => runRound(ai, contents, send, { ...tag, round }),
              () => {
                send({ type: "reset" });
                send({ type: "status", text: "The coach is busy right now. Hang on, trying again…" });
              },
            ).catch(async (err) => {
              // A malformed or empty reply usually comes out right on a second ask.
              if (err instanceof RetryRound) {
                send({ type: "reset" });
                return withPatience(() => runRound(ai, contents, send, { ...tag, round, retry: true }), () => send({ type: "reset" }), [1, 2]);
              }
              throw err;
            });

            // Apply the coach's saves to the member's data, and collect feed posts.
            const responses: ChatPart[] = [];
            const posts: PostDraft[] = [];
            const events: CoachEvent[] = [];
            for (const c of parts.filter((p) => p.functionCall)) {
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
                  functionResponse: {
                    ...base,
                    response: { error: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` },
                  },
                });
                continue;
              }
              const before = state;
              state = applyTool(state, name, parsed.data, newId);
              posts.push(...postsForSave(before, state, name, today));
              events.push({ type: "tool", name, input: parsed.data });
              responses.push({ functionResponse: { ...base, response: { result: "Saved. Now continue your message to the athlete." } } });
            }

            // The member's message is stored together with the first reply, so a
            // failed first attempt leaves nothing half-written.
            const newTurns: ChatContent[] = committed || !turn ? [] : [turn];
            newTurns.push({ role: "model", parts });
            if (responses.length) newTurns.push({ role: "user", parts: responses });
            state = {
              ...state,
              history: [...state.history, ...newTurns],
              ...(committed ? {} : { lastSnapshotVersion: state.stateVersion, pendingSummary: undefined }),
            };
            await saveState(member.id, state);
            committed = true;
            if (posts.length) await insertPosts(member.id, posts);

            send({ type: "model", parts });
            for (const e of events) send(e);
            if (responses.length) send({ type: "tool_responses", parts: responses });

            if (!responses.length) {
              send({ type: "done", stop: "STOP" });
              return;
            }
            contents = [...contents, { role: "model", parts }, { role: "user", parts: responses }];
          }
          // Too many saves in one reply: close the round off cleanly.
          state = { ...state, history: trimIncompleteTail(state.history) };
          await saveState(member.id, state);
          send({ type: "done", stop: "tool_limit" });
        } catch (err) {
          console.error(JSON.stringify({ evt: "coach_error", member: member.id, resume, committed, error: err instanceof Error ? err.message : String(err) }));
          const message = friendlyError(err);
          if (committed) {
            // Everything up to the last completed step is already saved. The
            // unfinished reply is left in place so the app can ask the coach to finish it.
            send({ type: "busy", message: "Your update was saved, but the coach could not finish replying. Tap Finish reply in a moment." });
          } else {
            send({ type: "busy", message });
          }
          send({ type: "done", stop: "error" });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed.
          }
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
  });
}
