import { beats } from "../metrics";
import { plannedPerWeek, weekStreak } from "../scoring";
import { weekStart } from "../time";
import type { CoachState, Metric, PostDraft, WorkoutLog } from "../types";

/**
 * Turn one coach save into the posts the group sees. Only meaningful moments
 * are posted: a logged session, a first baseline, a new personal best, a new
 * programme, and hitting the week's training target.
 */
export function postsForSave(before: CoachState, after: CoachState, tool: string, today: string): PostDraft[] {
  const posts: PostDraft[] = [];

  if (tool === "log_workout") {
    const added = after.logs.find((l) => !before.logs.some((b) => b.id === l.id));
    if (!added) return posts;
    posts.push({
      kind: "session",
      day: added.date,
      data: {
        session: added.session,
        completed: added.completed,
        exercises: added.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, load: e.load })),
        ...(added.felt_hard ? { felt_hard: added.felt_hard } : {}),
      },
    });
    const goal = weekGoal(before.logs, after.logs, added, plannedPerWeek(after.programme), today);
    if (goal) posts.push(goal);
  }

  if (tool === "record_metric") {
    const added = after.metrics.find((m) => !before.metrics.some((b) => b.id === m.id));
    if (!added) return posts;
    const earlier = before.metrics.filter((m) => m.key === added.key && m.date !== added.date && m.date <= added.date);
    if (earlier.length === 0) {
      posts.push({ kind: "baseline", day: added.date, data: metricData(added) });
    } else {
      const best = earlier.reduce((b, m) => (beats(added, m.value, b.value) ? m : b));
      if (beats(added, added.value, best.value)) {
        posts.push({ kind: "best", day: added.date, data: { ...metricData(added), previous: best.value } });
      }
    }
  }

  if (tool === "save_programme" && !before.programme && after.programme) {
    posts.push({
      kind: "programme",
      day: today,
      data: { title: after.programme.title, ...(after.programme.total_weeks ? { total_weeks: after.programme.total_weeks } : {}) },
    });
  }

  return posts;
}

function metricData(m: Metric) {
  return { key: m.key, label: m.label, value: m.value, unit: m.unit };
}

function weekGoal(before: WorkoutLog[], after: WorkoutLog[], added: WorkoutLog, planned: number, today: string): PostDraft | null {
  if (!added.completed) return null;
  const week = weekStart(added.date);
  const count = (logs: WorkoutLog[]) => logs.filter((l) => l.completed && weekStart(l.date) === week).length;
  if (count(before) >= planned || count(after) < planned) return null;
  return {
    kind: "week_goal",
    day: added.date,
    data: { sessions: count(after), planned, streak: weekStreak(after, planned, today < added.date ? added.date : today) },
  };
}
