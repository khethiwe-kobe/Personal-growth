import { transcriptText } from "@/lib/coach/history";
import { COACH_SYSTEM_PROMPT, COMPACT_PROMPT } from "@/lib/coach/system";
import { geminiKey, passcodeDenied, passcodeValid } from "@/lib/server/auth";
import { client, friendlyError, withFallback } from "@/lib/server/gemini";
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

  const ai = client(apiKey);
  try {
    const res = await withFallback((model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `${COMPACT_PROMPT}\n\n<transcript>\n${text}\n</transcript>` }] }],
        config: { systemInstruction: COACH_SYSTEM_PROMPT },
      }),
    );
    const summary = (res.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    if (!summary) return Response.json({ error: "Could not summarise this conversation." }, { status: 422 });
    return Response.json({ summary });
  } catch (err) {
    return Response.json({ error: friendlyError(err) }, { status: 502 });
  }
}
