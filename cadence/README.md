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

No configuration needed locally: with no `TURSO_*` variables set the app uses a
SQLite file at `./data/cadence.db`. The same code runs against Turso in
production — identical SQL, different endpoint.

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

## Deploying (free, and nothing gets erased)

The app runs on **Vercel** (free Hobby plan) with its data in **Turso** (free
plan — hosted SQLite). Both are free, neither sleeps your data, and the database
lives independently of the server, so redeploys can never wipe it.

### 1. Create the database (Turso)

1. Sign up at [turso.tech](https://turso.tech) and create a database.
2. Copy its **URL** (`libsql://…`) and create an **auth token**. Keep both.

### 2. Deploy the app (Vercel)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, import this repository.
3. Set **Root Directory** to `cadence` (important — the app is a subfolder).
4. Add these Environment Variables:

   | Name | Value |
   |------|-------|
   | `TURSO_DATABASE_URL` | the `libsql://…` URL from Turso |
   | `TURSO_AUTH_TOKEN` | the token from Turso |
   | `CADENCE_SESSION_SECRET` | any long random string you make up |
   | `CADENCE_INVITE_CODE` | the code your group will type at `/join`, e.g. `THREE-2026` |
   | `CADENCE_GROUP_NAME` | e.g. `The Three` |

5. **Deploy.** On the first request the app creates its tables and your group
   automatically.
6. Open the URL, click **Join with an invite code**, and create the first
   account. Share the same code with the other two — everyone lands in the
   same group.

### Why your data can't be erased

- **The database is separate from the server.** Vercel redeploys replace the
  app, never the data. Turso's free plan has no inactivity-pause-then-delete
  policy and includes 1-day point-in-time restore.
- **Nothing in the app hard-deletes history.** Removing a category archives it
  so past analytics keep their labels, archiving a goal keeps every check-in,
  and an interrupted focus session is marked rather than dropped. The only
  destructive actions are deleting an individual task or event, which you asked
  for explicitly.
- **You can hold your own copies.** **Settings → Your data → Download a full
  backup** gives each person a JSON file of everything they own, private notes
  included. For a whole-database copy, run from your laptop:

  ```bash
  cd cadence
  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run backup
  ```

  which writes `backups/cadence-YYYY-MM-DD.json` (every table, no password
  hashes). Do that occasionally and you have an off-platform copy no provider
  controls.

Verified against a simulated fresh deployment: first-boot group creation,
invite-only sign-up, a second member joining the same group, and accounts plus
group membership surviving a restart with no duplicate group created.

### Demo data on a real deployment

Don't run `npm run seed` against your live database — it creates the three demo
accounts with published passwords. The bootstrap group is all a real deployment
needs.

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
- **SQLite everywhere** via libSQL (`@libsql/client`): a local file in
  development, [Turso](https://turso.tech) in production, same queries either way
  (`lib/db.ts` holds the full schema: users, groups,
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
