# Cadence

A private accountability & productivity app for a small group of friends —
built for **Khethiwe** (working), **Lethabo** (student) and **Aldonia** (student),
but architected around users → groups → members so more people or groups can be
added without code changes.

> *"If I don't plan my day, track my goals and follow through, my friends will
> see that I'm slipping — and I'll see exactly where I'm slipping."*

## Running it

```bash
cd cadence
npm install
npm run seed     # creates the demo group + 3 demo accounts with 75 days of history
npm run dev      # http://localhost:3100
```

Demo accounts (change the passwords in Settings):

| username  | password        |
|-----------|-----------------|
| khethiwe  | `khethiwe-demo` |
| lethabo   | `lethabo-demo`  |
| aldonia   | `aldonia-demo`  |

- `npm run reset` deletes all demo accounts and their data (demo users are flagged
  `is_demo`; wiping never touches real accounts). The same reset/re-seed is
  available in-app under **Settings → Demo data** (demo accounts only).
- Real accounts are created at `/join` with the group invite code
  (the seeded group's code is `GROW-TOGETHER`).

### Production

```bash
npm run build
CADENCE_SESSION_SECRET=<long random string> npm run start
```

Environment (`.env.example`):

- `CADENCE_DB_PATH` — SQLite file location (default `./data/cadence.db`)
- `CADENCE_SESSION_SECRET` — cookie-session secret, required in production
- `CADENCE_OPEN_SIGNUP=1` — allow sign-up without an invite code (default off)

## What's inside

| Area | What it does |
|------|--------------|
| **Dashboard** | Today's score ring, tasks/goals/focus at a glance, friends' accountability cards (numbers only), pinned countdowns, 14-day momentum |
| **Today** | Daily planner (A/B/C priorities, categories, durations, optional schedule, private notes) + a 24-hour timeline that shows exactly which hours are planned, done, overdue, intentionally off (break/rest/travel/…) or **unaccounted** |
| **Goals** | Guided 5-step wizard that forces goals to be measurable (target, unit, frequency, minimum standard, deadline, evidence). Auto-generates daily/weekly/monthly tracking, streaks, consistency, missed periods |
| **Calendar** | Events with category, colour, time, private notes, reminders; pin up to 3 as dashboard countdowns |
| **Timetable** | Manual weekly schedule, paste-text import with review-before-save, file uploads for reference, one-tap "pull today's timetable into the planner" |
| **Focus** | Fully customisable timer (25/5 ×4 or 6h no breaks — your call). Leaving the tab mid-focus, refreshing or closing = **interrupted**, with an honest "why did you leave?" prompt. History is never deleted |
| **Analytics** | Transparent productivity score (the weights and inputs are shown), planned-vs-done hours, hours by category, weekly trend, A/B/C completion, unaccounted time |
| **Accountability** | Group table + weekly/monthly comparison, improvement-aware highlights (Most improved, Most consistent, …) |
| **Monthly Review** | Structured self-evaluation (sections adapt to student vs working), reflections, then a generated report with data-driven month-over-month insights |
| **Settings** | Profile + avatar, Light/Dark/System appearance (stored per account), categories, notification preferences, password change, group info |

## Privacy model

Everything a user creates is owned by `user_id`. Group members only ever see
**aggregates** computed in `lib/repo.ts` (`shared*` functions) — completion %,
goal progress %, streaks, focus totals. Task names, schedules, notes, a goal's
"why"/evidence, calendar details and reflections never leave the owner's account.
Any goal can additionally be hidden from the group entirely.

## Architecture

- **Next.js 16 (App Router) + React 19** — server components read, server actions write
- **SQLite** via better-sqlite3 (`lib/db.ts` holds the full schema: users, groups,
  group_members, categories, tasks, time_blocks, goals, goal_checkins,
  calendar_events, timetable_entries/uploads, focus_sessions, monthly_reviews,
  sessions, user_settings)
- **Auth**: scrypt password hashes, opaque session tokens (only SHA-256 hashes
  stored), httpOnly cookies
- **Calculation engines** are pure functions (`lib/analytics.ts`, `lib/goals.ts`)
  with a unit-test suite: `npm test`
- Timezone-aware per user; week = Monday–Sunday
- The productivity score is transparent: 45% task completion + 25% planned-time
  follow-through + 30% daily goals, re-normalised when a component has no data
  (an unplanned day is a rest day, not a zero) — the breakdown is shown in Analytics

## Tests

```bash
npm test         # 19 unit tests over goal progress + daily analytics engines
npm run typecheck
```
