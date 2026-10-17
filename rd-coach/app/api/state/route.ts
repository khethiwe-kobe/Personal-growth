import { bad, json, readJson, withMember } from "@/lib/server/http";
import { loadState, saveState } from "@/lib/server/state";
import { hydrateState, isEmptyState } from "@/lib/state";
import { EMPTY_STATE } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The member's own full state: private coaching data and shared progress. */
export async function GET(req: Request) {
  return withMember(req, async (member) => {
    const { state, version } = await loadState(member.id);
    return json({ state, version, member });
  });
}

/**
 * Replace the member's state from a backup ("restore"), or bring in data that
 * an earlier version kept on this device ("import", only into an empty account).
 */
export async function PUT(req: Request) {
  return withMember(req, async (member) => {
    const body = await readJson<{ state?: unknown; mode?: unknown }>(req);
    if (!body?.state || typeof body.state !== "object") return bad("No data to restore.");
    const current = await loadState(member.id);
    if (body.mode === "import" && !isEmptyState(current.state)) return json({ state: current.state, imported: false });
    const next = hydrateState(body.state);
    next.stateVersion = Math.max(next.stateVersion, current.state.stateVersion) + 1;
    await saveState(member.id, next);
    return json({ state: next, imported: true });
  });
}

/** Small edits made outside the conversation. */
export async function POST(req: Request) {
  return withMember(req, async (member) => {
    const body = await readJson<{ action?: unknown; id?: unknown }>(req);
    const { state } = await loadState(member.id);
    let next = state;
    switch (body?.action) {
      case "delete_log":
        next = { ...state, logs: state.logs.filter((l) => l.id !== body.id), stateVersion: state.stateVersion + 1 };
        break;
      case "clear_conversation":
        next = { ...state, history: [], stateVersion: state.stateVersion + 1 };
        break;
      case "reset":
        next = { ...EMPTY_STATE, createdAt: new Date().toISOString() };
        break;
      default:
        return bad("Unknown action.");
    }
    await saveState(member.id, next);
    return json({ state: next });
  });
}
