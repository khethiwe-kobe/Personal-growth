import { PROFILE_LABELS, CONTEXT_PREFIX, type ChatContent, type CoachState } from "../types";

function snapshot(state: CoachState): string {
  const lines: string[] = [];
  const prof = Object.entries(state.profile);
  if (prof.length) {
    lines.push("Profile:");
    for (const [k, v] of prof) lines.push(`- ${PROFILE_LABELS[k] ?? k}: ${String(v)}`);
  }
  if (state.programme) {
    lines.push(
      `Programme: ${state.programme.title}. Weekly schedule: ${state.programme.schedule
        .map((d) => `${d.day} ${d.session} (${d.duration_min} min)`)
        .join("; ")}.`,
    );
  }
  if (state.metrics.length) {
    lines.push("Metrics (latest per test):");
    const latest = new Map<string, CoachState["metrics"][number]>();
    for (const m of state.metrics) latest.set(m.key, m);
    for (const m of latest.values()) lines.push(`- ${m.label}: ${m.value} ${m.unit} on ${m.date}`);
  }
  if (state.logs.length) {
    lines.push("Recent sessions:");
    for (const w of state.logs.slice(0, 6)) {
      lines.push(
        `- ${w.date} ${w.session}${w.completed ? "" : " (incomplete)"}: ${w.exercises
          .map((e) => [e.name, e.sets && e.reps ? `${e.sets}x${e.reps}` : e.reps, e.load].filter(Boolean).join(" "))
          .join("; ")}`,
      );
    }
  }
  return lines.join("\n");
}

/** The athlete's message, preceded by the context block the coach reads but the UI hides. */
export function buildUserTurn(state: CoachState, text: string, opts: { name: string; today: string; longDate: string }): ChatContent {
  const ctx = [`Today is ${opts.longDate} (${opts.today}). The athlete's name is ${opts.name}.`];
  if (state.pendingSummary) {
    ctx.push("Summary of the coaching conversation so far (your own notes):\n" + state.pendingSummary);
  }
  if (state.stateVersion !== state.lastSnapshotVersion || state.pendingSummary) {
    const snap = snapshot(state);
    if (snap) ctx.push("Current tracked data on the athlete's dashboard:\n" + snap);
  }
  return { role: "user", parts: [{ text: `${CONTEXT_PREFIX}\n${ctx.join("\n\n")}\n</context>` }, { text }] };
}
