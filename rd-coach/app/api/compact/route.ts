import { transcriptText } from "@/lib/coach/history";
import { COACH_SYSTEM_PROMPT, COMPACT_PROMPT } from "@/lib/coach/system";
import { geminiKey } from "@/lib/server/auth";
import { client, friendlyError, withFallback, withPatience } from "@/lib/server/gemini";
import { bad, json, withMember } from "@/lib/server/http";
import { loadState, saveState } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Condense the member's conversation into the coach's own notes. */
export async function POST(req: Request) {
  return withMember(req, async (member) => {
    const apiKey = geminiKey();
    if (!apiKey) return bad("The server is missing GEMINI_API_KEY.", 500);
    const { state } = await loadState(member.id);
    const text = transcriptText(state.history);
    if (!text) return json({ state });
    const ai = client(apiKey);
    try {
      const res = await withPatience(
        () =>
          withFallback((model) =>
            ai.models.generateContent({
              model,
              contents: [{ role: "user", parts: [{ text: `${COMPACT_PROMPT}\n\n<transcript>\n${text}\n</transcript>` }] }],
              config: { systemInstruction: COACH_SYSTEM_PROMPT },
            }),
          ),
        () => {},
      );
      const summary = (res.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => typeof p.text === "string" && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      if (!summary) return bad("Could not summarise this conversation. Try again later.", 502);
      const next = {
        ...state,
        history: [],
        pendingSummary: [state.pendingSummary, summary].filter(Boolean).join("\n\n"),
        stateVersion: state.stateVersion + 1,
      };
      await saveState(member.id, next);
      return json({ state: next });
    } catch (err) {
      return bad(friendlyError(err), 503);
    }
  });
}
