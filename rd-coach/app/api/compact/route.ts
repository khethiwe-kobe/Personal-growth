import { ApiError, GoogleGenAI } from "@google/genai";
import { transcriptText } from "@/lib/coach/history";
import { COACH_SYSTEM_PROMPT, COMPACT_PROMPT } from "@/lib/coach/system";
import { GEMINI_MODEL, geminiKey, passcodeDenied, passcodeValid } from "@/lib/server/auth";
import type { ChatContent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Condense the transcript into the coach's own notes. */
export async function POST(req: Request) {
  let body: { history?: unknown; passcode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!passcodeValid(body.passcode)) return passcodeDenied();
  const apiKey = geminiKey();
  if (!apiKey) return Response.json({ error: "The server is missing GEMINI_API_KEY." }, { status: 500 });

  const history = Array.isArray(body.history) ? (body.history as ChatContent[]) : [];
  const text = transcriptText(history);
  if (!text) return Response.json({ summary: "" });

  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: `${COMPACT_PROMPT}\n\n<transcript>\n${text}\n</transcript>` }] }],
      config: { systemInstruction: COACH_SYSTEM_PROMPT },
    });
    const summary = (res.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    if (!summary) return Response.json({ error: "Could not summarise this conversation." }, { status: 422 });
    return Response.json({ summary });
  } catch (err) {
    const message = err instanceof ApiError ? `AI service error ${err.status}: ${err.message}` : "Failed to condense.";
    return Response.json({ error: message }, { status: 502 });
  }
}
