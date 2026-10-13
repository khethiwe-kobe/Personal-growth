# RD Coach

A strength and conditioning coach for RD preparation, shared by the JHB
training group. Each person gets a private Gemini-powered coach that assesses
them, builds a periodised programme, prescribes each session and adjusts it
from what they report. The group shares a team feed and a competitive
scoreboard: sessions, personal bests and daily progress photos, with comments
and reactions.

## Setting it up on Vercel

1. **Project.** Root Directory `rd-coach`, framework preset **Next.js**.
2. **Database.** In the project's **Storage** tab, create a **Neon** Postgres
   database and connect it to the project. Vercel adds `DATABASE_URL` for you.
   Tables are created automatically on first use.
3. **Environment variables:**

   | Variable | Purpose |
   |----------|---------|
   | `GEMINI_API_KEY` | Key from Google AI Studio. |
   | `COACH_PASSCODE` | The JHB join code. People need it once to create an account. |
   | `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`. |
   | `GEMINI_FALLBACK_MODELS` | Optional. Defaults to `gemini-3.6-flash,gemini-3.5-flash-lite`. |

4. **Redeploy**, then open the app and join first: the first account becomes
   the group admin.
5. Share the link and the join code with the JHB group.

### Keeping the coach reliable

Requests that hit a busy period are retried, moved to a backup model, and
then waited out (with a calm "hang on" note) for up to about a minute before
anyone sees a message. Free-tier Gemini traffic is the first to be turned away
when Google is busy, so for a dependable coach turn on billing for the API
key's Google Cloud project in AI Studio. That moves the key to the paid tier
(priority over free traffic, higher limits, and prompts are not used to
improve Google's products). Set a budget alert in Google Cloud if you like.

## Running it locally

```bash
cd rd-coach
npm install
cp .env.example .env.local   # DATABASE_URL=pglite:./.data/pg works without Postgres
npm run dev                  # http://localhost:3200
```

## How it is put together

| Area | What it does |
|------|--------------|
| **Coach** | Private streaming conversation. Starts with an assessment, moves through analysis and programme design, then daily coaching. Quick actions for today's session, a post-session report form and a progress photo. |
| **Team** | Feed of everyone's sessions, baselines, personal bests, week targets and progress photos, with comments and four reactions (Strong, Respect, Keep going, Inspiring). Scoreboard for this week and all time, with member pages. |
| **Programme** | The weekly schedule, periodisation blocks and principles the coach saved. Today's row is highlighted. |
| **Log** | Every reported session: exercises with sets, reps and loads, what felt easy or hard, pain notes, and the coach's note for next time. |
| **Progress** | Baselines and reassessments per test with change and a small trend line; timed efforts count a lower time as an improvement. Profile summary and consistency counts. |
| **Settings** | Account and sign out, group members (admin can remove people), condense or clear the conversation, backup and restore, start over. |

### Accounts and privacy

People join with the group code, a name, a username and a password, and stay
signed in for six months on each device. The first account is the admin, who
can remove members and delete any post or comment. Removed members are signed
out and disappear from the feed and scoreboard.

Each member's coaching conversation and the profile the coach builds (age,
injuries, sleep and so on) are private. Their programme, logged sessions,
tests and photos are shared with the group. Photos are stored in the database
and only served to signed-in members.

### Scoreboard

| Earns points | Points |
|--------------|--------|
| Completed session (up to 2 a day) | 10 |
| Partly completed session | 5 |
| Day with a progress photo | 3 |
| New personal best on a tracked test | 5 |
| First baseline for a test | 2 |

The week streak counts weeks in a row in which someone did all the sessions
their programme plans, so rest days never break it. Weeks run Monday to
Sunday, Johannesburg time.

### Data

Everything is stored in Postgres (`lib/server/db.ts` holds the schema). The
browser keeps a copy of the signed-in member's data so pages open instantly.
Data saved on a device by the first, local-only version is offered for import
on first sign-in.

### The coach's tools

The model keeps the dashboard current by calling tools during the conversation:
`update_profile`, `record_metric`, `save_programme`, `log_workout` and
`set_phase`. The route handler validates each call (`lib/coach/tools.ts`,
Zod), applies it to the member's stored data (`lib/coach/apply.ts`), turns
meaningful saves into team posts (`lib/coach/achievements.ts`), and streams
everything to the browser. Each step is saved as it completes, so closing the
app mid-reply loses nothing. The browser stores the
model's turns exactly as Gemini returned them, thought signatures included, so
multi-step tool use keeps its reasoning across requests. Today's date and any
data you edit by hand are passed to the coach inside the next message rather
than by editing earlier turns.

Long conversations are condensed automatically (the coach writes its own
summary, which becomes the opening context of the next message) and can be
condensed by hand from Settings.

### Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, `@google/genai`, Neon Postgres, Zod. Tests run against an in-process Postgres (PGlite).
No icon or markdown libraries: the coach's replies are rendered by a small
Markdown renderer in `lib/markdown.tsx`.

```bash
npm test          # tools, transcripts, scoring, achievements, accounts, feed, fallback
npm run typecheck
```
