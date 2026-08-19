import type { SharedToday } from "./repo";
import { fmtMinutes } from "./time";

/**
 * Accountability messaging — data-driven, adult in tone.
 * Messages are generated from real numbers, never random cheerleading.
 */

function pct(s: SharedToday): number {
  return s.tasksPlanned ? Math.round((s.tasksCompleted / s.tasksPlanned) * 100) : 0;
}

export function messagesForMe(me: SharedToday, friends: SharedToday[]): string[] {
  const out: string[] = [];
  const remainingTasks = me.tasksPlanned - me.tasksCompleted;

  if (me.tasksPlanned === 0 && me.goalsDue === 0) {
    out.push("Nothing planned yet today. A five-minute plan changes the whole day.");
    return out;
  }
  if (remainingTasks === 1) out.push("One more task to hit 100%.");
  else if (remainingTasks > 1 && pct(me) >= 70)
    out.push(`${remainingTasks} tasks left — you're close.`);

  if (me.productiveStreak >= 3)
    out.push(`You've completed ${me.productiveStreak} productive days in a row.`);

  const ahead = friends.some((f) => f.score > me.score);
  if (ahead && me.score > 0)
    out.push("A friend is ahead of you today — there's still time.");
  if (!ahead && friends.some((f) => f.tasksPlanned > 0) && me.score > 0)
    out.push("You're ahead today. Keep the pace.");

  if (me.goalsDue > 0 && me.goalsCompleted === me.goalsDue)
    out.push("All daily goals done. That's the discipline compounding.");

  return out.slice(0, 3);
}

export function messageForFriend(f: SharedToday, name: string): string {
  if (f.tasksPlanned === 0 && f.goalsDue === 0) return `${name} hasn't planned today yet.`;
  const p = pct(f);
  if (p === 100 && f.tasksPlanned > 0) return `${name} finished everything planned today.`;
  if (f.productiveStreak >= 5) return `${name} is on a ${f.productiveStreak}-day run.`;
  if (f.focusMinutes >= 120) return `${name} has logged ${fmtMinutes(f.focusMinutes)} of focus today.`;
  if (p >= 75) return `${name} is nearly done for the day.`;
  return `${name} is working through today's plan.`;
}
