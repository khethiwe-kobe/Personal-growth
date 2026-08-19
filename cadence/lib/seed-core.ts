import { getDb } from "./db";
import { hashPassword } from "./auth";
import { todayInTz, addDays, weekdayIndex } from "./time";

/**
 * Deterministic demo data for Khethiwe (working), Lethabo (student) and
 * Aldonia (student). Everything is generated relative to "today" in
 * Africa/Johannesburg so the app always looks alive, and every demo row can
 * be wiped in one call (users are flagged is_demo=1).
 *
 * Demo passwords (change them in Settings):
 *   khethiwe / khethiwe-demo   lethabo / lethabo-demo   aldonia / aldonia-demo
 */

const TZ = "Africa/Johannesburg";
const HISTORY_DAYS = 75;

// Small deterministic PRNG so the demo is stable run-to-run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function wipeDemoData() {
  const db = getDb();
  const ids = (db.prepare("SELECT id FROM users WHERE is_demo=1").all() as { id: number }[])
    .map((r) => r.id);
  const tx = db.transaction(() => {
    for (const id of ids) db.prepare("DELETE FROM users WHERE id=?").run(id); // cascades
    db.prepare(
      "DELETE FROM groups WHERE id NOT IN (SELECT DISTINCT group_id FROM group_members)"
    ).run();
  });
  tx();
}

export function seedDemoData() {
  const db = getDb();
  const today = todayInTz(TZ);
  const start = addDays(today, -HISTORY_DAYS);

  const tx = db.transaction(() => {
    // ----- group -----
    const g = db.prepare(
      "INSERT INTO groups (name, invite_code) VALUES ('The Three', 'GROW-TOGETHER')"
    ).run();
    const groupId = Number(g.lastInsertRowid);

    const mkUser = (
      username: string, name: string, role: string, bio: string, accent: string
    ) => {
      const info = db.prepare(
        `INSERT INTO users (username, display_name, password_hash, role, bio, timezone, accent, is_demo)
         VALUES (?,?,?,?,?,?,?,1)`
      ).run(username, name, hashPassword(`${username}-demo`), role, bio, TZ, accent);
      const id = Number(info.lastInsertRowid);
      db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").run(id);
      db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?,?)").run(groupId, id);
      return id;
    };

    const khethiwe = mkUser("khethiwe", "Khethiwe", "working",
      "Working, building, growing. One planned day at a time.", "sage");
    const lethabo = mkUser("lethabo", "Lethabo", "student",
      "Final-year student. Discipline over motivation.", "blue");
    const aldonia = mkUser("aldonia", "Aldonia", "student",
      "Student. Faith first, then the books.", "blush");

    // ----- categories -----
    const mkCats = (userId: number, cats: [string, string][]) => {
      const map = new Map<string, number>();
      cats.forEach(([name, color], i) => {
        const r = db.prepare(
          "INSERT INTO categories (user_id, name, color, position) VALUES (?,?,?,?)"
        ).run(userId, name, color, i);
        map.set(name, Number(r.lastInsertRowid));
      });
      return map;
    };

    const kCats = mkCats(khethiwe, [
      ["Work", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
      ["Finance", "#d9c9a8"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"],
    ]);
    const lCats = mkCats(lethabo, [
      ["Academic", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
      ["Social", "#d9b8c4"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"],
    ]);
    const aCats = mkCats(aldonia, [
      ["Academic", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Social", "#d9b8c4"],
      ["Exercise", "#a8c5b4"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"],
    ]);

    // ----- goals -----
    type GoalSpec = {
      cat: number | undefined; title: string; why: string; measurement: string;
      type: string; unit: string; freq: string; target: number; minimum: number;
      overall?: number; action: string; evidence: string; days?: string;
      rate: number; // demo completion probability
    };
    const mkGoal = (userId: number, s: GoalSpec) => {
      const r = db.prepare(
        `INSERT INTO goals (user_id, category_id, title, why, measurement, tracking_type,
          unit, frequency, period_target, minimum_target, overall_target, daily_action,
          evidence, start_date, active_days)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        userId, s.cat ?? null, s.title, s.why, s.measurement, s.type, s.unit, s.freq,
        s.target, s.minimum, s.overall ?? null, s.action, s.evidence, start,
        s.days ?? "0,1,2,3,4,5,6"
      );
      return { id: Number(r.lastInsertRowid), spec: s, userId };
    };

    const goals = [
      // Khethiwe — working
      mkGoal(khethiwe, {
        cat: kCats.get("Spiritual"), title: "Bible reading",
        why: "Stay rooted — everything else flows from this.",
        measurement: "Chapters read per day", type: "number", unit: "chapters",
        freq: "daily", target: 3, minimum: 1,
        action: "Read 3 chapters before checking my phone.",
        evidence: "Log chapters in the app each morning.", rate: 0.82,
      }),
      mkGoal(khethiwe, {
        cat: kCats.get("Exercise"), title: "Train 4× per week",
        why: "Energy for work and long-term health.",
        measurement: "Gym or run sessions per week", type: "frequency", unit: "sessions",
        freq: "weekly", target: 4, minimum: 2,
        action: "Train Mon/Tue/Thu/Sat mornings.",
        evidence: "Log each session after finishing.", rate: 0.7,
      }),
      mkGoal(khethiwe, {
        cat: kCats.get("Finance"), title: "Save R2 500 per month",
        why: "Emergency fund to 3 months of expenses.",
        measurement: "Rand moved to savings", type: "number", unit: "R",
        freq: "monthly", target: 2500, minimum: 1500, overall: 30000,
        action: "Transfer on payday before anything else.",
        evidence: "Bank transfer reference.", rate: 0.9,
      }),
      mkGoal(khethiwe, {
        cat: kCats.get("Work"), title: "Deep work 2h per day",
        why: "Ship the projects that actually move my career.",
        measurement: "Focused hours on priority project", type: "time", unit: "min",
        freq: "daily", target: 120, minimum: 60, days: "0,1,2,3,4",
        action: "First 2 hours of the workday = deep work, no meetings.",
        evidence: "Focus timer sessions.", rate: 0.75,
      }),
      // Lethabo — student
      mkGoal(lethabo, {
        cat: lCats.get("Academic"), title: "Study 3h per day",
        why: "Graduate with distinction.",
        measurement: "Hours of real studying", type: "time", unit: "min",
        freq: "daily", target: 180, minimum: 90, days: "0,1,2,3,4,5",
        action: "Two 90-minute blocks: morning and afternoon.",
        evidence: "Focus timer + study log.", rate: 0.78,
      }),
      mkGoal(lethabo, {
        cat: lCats.get("Spiritual"), title: "Bible reading",
        why: "Keep first things first during exam pressure.",
        measurement: "Chapters per day", type: "number", unit: "chapters",
        freq: "daily", target: 2, minimum: 1,
        action: "Read after breakfast.", evidence: "Log in app.", rate: 0.72,
      }),
      mkGoal(lethabo, {
        cat: lCats.get("Exercise"), title: "Run 3× per week",
        why: "Clear head, better sleep.",
        measurement: "Runs per week", type: "frequency", unit: "runs",
        freq: "weekly", target: 3, minimum: 1,
        action: "Run Tue/Thu/Sat before supper.",
        evidence: "Log each run.", rate: 0.62,
      }),
      // Aldonia — student
      mkGoal(aldonia, {
        cat: aCats.get("Academic"), title: "Finish assignments 2 days early",
        why: "Stop the deadline panic cycle.",
        measurement: "Assignment work sessions per week", type: "frequency", unit: "sessions",
        freq: "weekly", target: 5, minimum: 3,
        action: "One assignment block every weekday.",
        evidence: "Submission timestamps.", rate: 0.8,
      }),
      mkGoal(aldonia, {
        cat: aCats.get("Spiritual"), title: "Bible reading",
        why: "Grow deeper this year.",
        measurement: "Chapters per day", type: "number", unit: "chapters",
        freq: "daily", target: 3, minimum: 1,
        action: "Morning reading before campus.",
        evidence: "Log in app.", rate: 0.88,
      }),
      mkGoal(aldonia, {
        cat: aCats.get("Social"), title: "Meaningful catch-up 2× per week",
        why: "Keep real friendships alive, not just group chats.",
        measurement: "Real conversations or visits per week", type: "frequency", unit: "catch-ups",
        freq: "weekly", target: 2, minimum: 1,
        action: "Coffee/call with someone Tue + Sun.",
        evidence: "Log it same day.", rate: 0.75,
      }),
    ];

    // ----- goal check-ins -----
    const rand = rng(42);
    const insCheckin = db.prepare(
      "INSERT INTO goal_checkins (goal_id, user_id, date, value) VALUES (?,?,?,?)"
    );
    for (const { id, spec, userId } of goals) {
      const activeDays = new Set((spec.days ?? "0,1,2,3,4,5,6").split(",").map(Number));
      for (let d = start; d <= today; d = addDays(d, 1)) {
        const dow = weekdayIndex(d);
        if (spec.freq === "daily") {
          if (!activeDays.has(dow)) continue;
          if (d === today && rand() < 0.5) continue; // today often still open
          const r = rand();
          if (r < spec.rate) insCheckin.run(id, userId, d, spec.target);
          else if (r < spec.rate + 0.12)
            insCheckin.run(id, userId, d, Math.max(1, Math.round(spec.target * 0.5)));
          // else: missed day — the analytics must show it honestly
        } else if (spec.freq === "weekly") {
          // Spread target across the week with per-day probability.
          const p = (spec.target / 7) * (spec.rate + 0.25);
          if (rand() < p && d !== today) insCheckin.run(id, userId, d, 1);
        } else if (spec.freq === "monthly") {
          // One transfer near the 25th (payday), most months.
          if (d.endsWith("-25") && rand() < spec.rate)
            insCheckin.run(id, userId, d, spec.target);
          else if (d.endsWith("-26") && rand() < 0.3)
            insCheckin.run(id, userId, d, Math.round(spec.target * 0.4));
        }
      }
    }

    // ----- daily tasks + time blocks + focus history -----
    const insTask = db.prepare(
      `INSERT INTO tasks (user_id, date, name, category_id, priority, planned_minutes,
        start_min, end_min, completed, completed_at, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    );
    const insBlock = db.prepare(
      "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label) VALUES (?,?,?,?,?,?)"
    );
    const insFocus = db.prepare(
      `INSERT INTO focus_sessions (user_id, date, started_at, ended_at, planned_minutes,
        focus_seconds, status, interrupt_reason, label)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );

    type DayPlan = {
      name: string; cat: number | undefined; pri: string; mins: number;
      start?: number; end?: number; doneP: number; note?: string;
    }[];

    const kWeekday: DayPlan = [
      { name: "Morning devotion", cat: kCats.get("Spiritual"), pri: "A", mins: 30, start: 390, end: 420, doneP: 0.85 },
      { name: "Deep work: main project", cat: kCats.get("Work"), pri: "A", mins: 120, start: 480, end: 600, doneP: 0.8 },
      { name: "Email + admin sweep", cat: kCats.get("Admin"), pri: "C", mins: 45, start: 600, end: 645, doneP: 0.85 },
      { name: "Meetings block", cat: kCats.get("Work"), pri: "B", mins: 120, start: 660, end: 780, doneP: 0.9 },
      { name: "Afternoon work block", cat: kCats.get("Work"), pri: "B", mins: 150, start: 840, end: 990, doneP: 0.75 },
      { name: "Gym session", cat: kCats.get("Exercise"), pri: "B", mins: 60, start: 1050, end: 1110, doneP: 0.65 },
      { name: "Budget check-in", cat: kCats.get("Finance"), pri: "C", mins: 15, start: 1230, end: 1245, doneP: 0.55 },
    ];
    const kWeekend: DayPlan = [
      { name: "Extended devotion", cat: kCats.get("Spiritual"), pri: "A", mins: 60, start: 480, end: 540, doneP: 0.85 },
      { name: "Long run", cat: kCats.get("Exercise"), pri: "B", mins: 75, start: 570, end: 645, doneP: 0.6 },
      { name: "Life admin", cat: kCats.get("Admin"), pri: "B", mins: 90, start: 690, end: 780, doneP: 0.7 },
      { name: "Reading / learning", cat: kCats.get("Personal"), pri: "C", mins: 60, start: 960, end: 1020, doneP: 0.6 },
    ];
    const lWeekday: DayPlan = [
      { name: "Morning reading", cat: lCats.get("Spiritual"), pri: "A", mins: 25, start: 415, end: 440, doneP: 0.75 },
      { name: "Lectures", cat: lCats.get("Academic"), pri: "A", mins: 180, start: 480, end: 660, doneP: 0.92 },
      { name: "Study block 1", cat: lCats.get("Academic"), pri: "A", mins: 90, start: 690, end: 780, doneP: 0.8 },
      { name: "Study block 2", cat: lCats.get("Academic"), pri: "B", mins: 90, start: 840, end: 930, doneP: 0.7 },
      { name: "Run", cat: lCats.get("Exercise"), pri: "B", mins: 40, start: 1020, end: 1060, doneP: 0.55 },
      { name: "Tutorial prep", cat: lCats.get("Academic"), pri: "C", mins: 45, start: 1140, end: 1185, doneP: 0.6 },
    ];
    const lWeekend: DayPlan = [
      { name: "Church / rest morning", cat: lCats.get("Spiritual"), pri: "A", mins: 120, start: 510, end: 630, doneP: 0.9 },
      { name: "Catch-up studying", cat: lCats.get("Academic"), pri: "B", mins: 120, start: 840, end: 960, doneP: 0.65 },
      { name: "Time with friends", cat: lCats.get("Social"), pri: "C", mins: 120, start: 990, end: 1110, doneP: 0.8 },
    ];
    const aWeekday: DayPlan = [
      { name: "Morning devotion", cat: aCats.get("Spiritual"), pri: "A", mins: 30, start: 390, end: 420, doneP: 0.9 },
      { name: "Campus classes", cat: aCats.get("Academic"), pri: "A", mins: 200, start: 495, end: 695, doneP: 0.95 },
      { name: "Assignment session", cat: aCats.get("Academic"), pri: "A", mins: 90, start: 720, end: 810, doneP: 0.82 },
      { name: "Library revision", cat: aCats.get("Academic"), pri: "B", mins: 60, start: 870, end: 930, doneP: 0.7 },
      { name: "Walk / exercise", cat: aCats.get("Exercise"), pri: "C", mins: 30, start: 1020, end: 1050, doneP: 0.5 },
      { name: "Journal + plan tomorrow", cat: aCats.get("Personal"), pri: "B", mins: 20, start: 1260, end: 1280, doneP: 0.75 },
    ];
    const aWeekend: DayPlan = [
      { name: "Church", cat: aCats.get("Spiritual"), pri: "A", mins: 150, start: 510, end: 660, doneP: 0.95 },
      { name: "Coffee with a friend", cat: aCats.get("Social"), pri: "B", mins: 90, start: 840, end: 930, doneP: 0.8 },
      { name: "Assignment head-start", cat: aCats.get("Academic"), pri: "B", mins: 90, start: 960, end: 1050, doneP: 0.6 },
    ];

    const people: {
      userId: number; weekday: DayPlan; weekend: DayPlan;
      focusRate: number; focusLabel: string;
    }[] = [
      { userId: khethiwe, weekday: kWeekday, weekend: kWeekend, focusRate: 0.7, focusLabel: "Deep work" },
      { userId: lethabo, weekday: lWeekday, weekend: lWeekend, focusRate: 0.75, focusLabel: "Study session" },
      { userId: aldonia, weekday: aWeekday, weekend: aWeekend, focusRate: 0.6, focusLabel: "Assignment focus" },
    ];

    for (const p of people) {
      for (let d = start; d <= today; d = addDays(d, 1)) {
        const dow = weekdayIndex(d);
        const isToday = d === today;
        const plan = dow <= 4 ? p.weekday : p.weekend;
        // Occasionally a whole day goes unplanned (life happens).
        if (rand() < 0.06 && !isToday) continue;
        for (const t of plan) {
          if (rand() < 0.08) continue; // not every task every day
          let done = rand() < t.doneP;
          if (isToday) {
            // Today: only tasks whose slot has passed *might* be done.
            const nowMin = new Date().getUTCHours() * 60 + 120; // rough SAST
            done = t.end !== undefined && t.end < nowMin ? rand() < t.doneP : false;
          }
          insTask.run(
            p.userId, d, t.name, t.cat ?? null, t.pri, t.mins,
            t.start ?? null, t.end ?? null, done ? 1 : 0,
            done ? d + "T18:00:00.000Z" : null, ""
          );
        }
        // Intentional blocks: lunch + evening rest cover the non-task hours.
        insBlock.run(p.userId, d, 780, 840, "break", "Lunch");
        insBlock.run(p.userId, d, 1110, 1230, "personal", "Supper & family");
        if (dow >= 5) insBlock.run(p.userId, d, 690, 840, "rest", "Slow afternoon");
        // Focus sessions on ~focusRate of days.
        if (rand() < p.focusRate && !isToday) {
          const sessions = 1 + Math.floor(rand() * 2);
          for (let sIdx = 0; sIdx < sessions; sIdx++) {
            const planned = [50, 90, 120][Math.floor(rand() * 3)];
            const interrupted = rand() < 0.18;
            const seconds = interrupted
              ? Math.round(planned * 60 * (0.2 + rand() * 0.5))
              : planned * 60;
            insFocus.run(
              p.userId, d,
              `${d}T${String(8 + sIdx * 3).padStart(2, "0")}:00:00.000Z`,
              `${d}T${String(10 + sIdx * 3).padStart(2, "0")}:00:00.000Z`,
              planned, seconds,
              interrupted ? "interrupted" : "completed",
              interrupted ? ["distracted", "urgent", "unplanned_break"][Math.floor(rand() * 3)] : null,
              p.focusLabel
            );
          }
        }
      }
    }

    // ----- calendar events + countdowns -----
    const insEvent = db.prepare(
      `INSERT INTO calendar_events (user_id, title, date, start_min, end_min, category,
        color, notes, reminder_minutes, countdown_slot)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    insEvent.run(khethiwe, "Quarterly review presentation", addDays(today, 9), 540, 600,
      "deadline", "#d9c9a8", "Slides due to manager two days before.", 1440, 1);
    insEvent.run(khethiwe, "Church conference", addDays(today, 16), 480, 900,
      "church", "#cbb9d9", "", 1440, 2);
    insEvent.run(khethiwe, "Mom's birthday", addDays(today, 24), null, null,
      "birthday", "#d9b8c4", "Order flowers early.", 2880, 3);
    insEvent.run(lethabo, "Software Engineering exam", addDays(today, 12), 540, 720,
      "exam", "#b7c4d6", "Chapters 4–9.", 2880, 1);
    insEvent.run(lethabo, "Database assignment due", addDays(today, 5), 1020, null,
      "assignment", "#d9c9a8", "Submit on the portal before 17:00.", 1440, 2);
    insEvent.run(lethabo, "Youth camp", addDays(today, 30), null, null,
      "church", "#cbb9d9", "", null, 3);
    insEvent.run(aldonia, "Psychology test", addDays(today, 7), 600, 660,
      "test", "#b7c4d6", "", 1440, 1);
    insEvent.run(aldonia, "Research essay due", addDays(today, 14), 1020, null,
      "assignment", "#d9c9a8", "", 2880, 2);
    insEvent.run(aldonia, "Cape Town trip", addDays(today, 23), null, null,
      "personal", "#a8c5b4", "", null, 3);

    // ----- timetables (students) -----
    const insTT = db.prepare(
      `INSERT INTO timetable_entries (user_id, day_of_week, start_min, end_min, title, location, color, source)
       VALUES (?,?,?,?,?,?,?, 'manual')`
    );
    // Lethabo — CS student
    insTT.run(lethabo, 0, 480, 600, "Software Engineering", "B2 Lecture Hall", "#b7c4d6", );
    insTT.run(lethabo, 0, 660, 780, "Databases", "Lab 4", "#b7c4d6");
    insTT.run(lethabo, 1, 540, 660, "Networks", "B1", "#b7c4d6");
    insTT.run(lethabo, 2, 480, 600, "Software Engineering", "B2", "#b7c4d6");
    insTT.run(lethabo, 2, 840, 960, "Databases practical", "Lab 4", "#a8c5b4");
    insTT.run(lethabo, 3, 600, 720, "Statistics", "C3", "#b7c4d6");
    insTT.run(lethabo, 4, 480, 570, "Networks tutorial", "Lab 2", "#a8c5b4");
    // Aldonia — psych student
    insTT.run(aldonia, 0, 495, 615, "Psychology 301", "Main Hall", "#b7c4d6");
    insTT.run(aldonia, 1, 615, 735, "Research Methods", "H2", "#b7c4d6");
    insTT.run(aldonia, 2, 495, 615, "Psychology 301", "Main Hall", "#b7c4d6");
    insTT.run(aldonia, 3, 735, 855, "Sociology", "H4", "#b7c4d6");
    insTT.run(aldonia, 4, 495, 585, "Stats for Social Science", "Lab 1", "#a8c5b4");

    // ----- monthly reviews for the previous month -----
    const prevMonth = addDays(today.slice(0, 7) + "-01", -1).slice(0, 7);
    const insReview = db.prepare(
      `INSERT INTO monthly_reviews (user_id, month, answers_json, submitted_at)
       VALUES (?,?,?,?)`
    );
    const mkAnswers = (o: Record<string, unknown>) => JSON.stringify(o);
    insReview.run(khethiwe, prevMonth, mkAnswers({
      ratings: { work: 7, structure: 6, spiritual: 8, social: 6, financial: 8, physical: 5 },
      went_well: "Shipped the reporting project and kept my morning readings consistent.",
      not_well: "Gym fell apart in week 3 — late nights at work.",
      procrastinated: "Preparing the budget review.",
      distraction: "Phone after 21:00.",
      most_progress: "Savings — hit the transfer both paydays.",
      neglected: "Training.",
      stop: "Screens in bed.", start: "Laying out gym clothes the night before.",
      continue: "Morning devotion before phone.",
      priority: "Rebuild the 4×/week training rhythm.",
    }), prevMonth + "-28T18:00:00.000Z");
    insReview.run(lethabo, prevMonth, mkAnswers({
      ratings: { academic: 8, structure: 6, spiritual: 6, social: 7, financial: 6, physical: 5 },
      went_well: "Study blocks actually happened most days.",
      not_well: "Runs kept losing to 'one more chapter'.",
      procrastinated: "Networks tutorial questions.",
      distraction: "YouTube between study blocks.",
      most_progress: "Study consistency.", neglected: "Running.",
      stop: "Studying in bed.", start: "Runs straight after last lecture.",
      continue: "Morning reading.", priority: "Exam prep schedule for the finals.",
    }), prevMonth + "-29T15:00:00.000Z");
    insReview.run(aldonia, prevMonth, mkAnswers({
      ratings: { academic: 7, structure: 7, spiritual: 9, social: 8, financial: 6, physical: 4 },
      went_well: "Devotions nearly every day, and assignments went in early.",
      not_well: "Basically no exercise.",
      procrastinated: "Stats revision.", distraction: "Group chats during study time.",
      most_progress: "Bible reading streak.", neglected: "Exercise.",
      stop: "Phone in the library.", start: "A 20-minute walk after classes.",
      continue: "Early assignment starts.", priority: "Pass stats test with 70%+.",
    }), prevMonth + "-30T10:00:00.000Z");
  });
  tx();
}
