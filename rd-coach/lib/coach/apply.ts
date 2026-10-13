import { TOOL_SCHEMAS, isToolName } from "./tools";
import type { CoachState } from "../types";

/** Apply a validated coach tool call to the athlete's local state. Pure. */
export function applyTool(state: CoachState, name: string, rawInput: unknown, makeId: () => string): CoachState {
  if (!isToolName(name)) return state;
  const parsed = TOOL_SCHEMAS[name].safeParse(rawInput);
  if (!parsed.success) return state;

  switch (name) {
    case "update_profile": {
      const { fields } = parsed.data as { fields: Record<string, string | number | boolean | null> };
      return { ...state, profile: { ...state.profile, ...fields } };
    }
    case "record_metric": {
      const m = parsed.data as Omit<CoachState["metrics"][number], "id">;
      // Same key on the same date replaces the earlier value.
      const metrics = state.metrics.filter((x) => !(x.key === m.key && x.date === m.date));
      metrics.push({ id: makeId(), ...m });
      metrics.sort((a, b) => a.date.localeCompare(b.date));
      return { ...state, metrics };
    }
    case "save_programme": {
      const p = parsed.data as Omit<NonNullable<CoachState["programme"]>, "updated_at">;
      return { ...state, programme: { ...p, updated_at: new Date().toISOString() } };
    }
    case "log_workout": {
      const w = parsed.data as Omit<CoachState["logs"][number], "id">;
      const logs = [{ id: makeId(), ...w }, ...state.logs];
      logs.sort((a, b) => b.date.localeCompare(a.date));
      return { ...state, logs };
    }
    case "set_phase": {
      const { phase } = parsed.data as { phase: CoachState["phase"] };
      return { ...state, phase };
    }
  }
}
