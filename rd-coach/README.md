# RD Coach

A personal strength and conditioning coach for RD preparation, built on the
Claude API. The coach interviews you in short groups of questions, assesses your
strengths and weaknesses, builds a periodised programme for the weeks you have,
then prescribes each day's session and adjusts it from what you report.

The objective it works towards is capability, not aesthetics: functional
strength, muscular and cardiovascular endurance, explosive power, relative
strength, mobility, core, grip, work capacity and useful muscle.

## Running it

```bash
cd rd-coach
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3200
```

Without a server key you can paste one under **Settings**; it is stored in the
browser and sent only with your own requests.

### Production

```bash
npm run build
ANTHROPIC_API_KEY=sk-ant-... npm run start
```

The app needs a Node server for its two API routes (`/api/coach` and
`/api/compact`), so it deploys to Vercel or any Node host rather than GitHub
Pages. Optional: `COACH_MODEL` overrides the model (default `claude-opus-5-5`).

## How it is put together

| Area | What it does |
|------|--------------|
| **Coach** | Streaming conversation. Starts with an assessment, moves through analysis and programme design, then daily coaching. Quick actions for "Today's session" and a structured post-session report form. |
| **Programme** | The weekly schedule, periodisation blocks and principles the coach saved. Today's row is highlighted. |
| **Log** | Every reported session: exercises with sets, reps and loads, what felt easy or hard, pain notes, and the coach's note for next time. |
| **Progress** | Baselines and reassessments per test with change and a small trend line; timed efforts count a lower time as an improvement. Profile summary and consistency counts. |
| **Settings** | API key, condense or clear the conversation, JSON backup and restore, full reset. |

### Data

Local-first. Everything (profile, programme, log, metrics and the full
transcript) lives in `localStorage` under `rd-coach:v1`. The server keeps
nothing. Download a backup from Settings before clearing site data.

### The coach's tools

The model keeps the dashboard current by calling tools during the conversation:
`update_profile`, `record_metric`, `save_programme`, `log_workout` and
`set_phase`. The route handler validates each call (`lib/coach/tools.ts`,
Zod), answers "Saved", and streams the validated input to the browser, which
applies it to the local store (`lib/coach/apply.ts`). The browser stores the
assistant turns verbatim so the transcript is append-only; today's date and any
data you edit by hand are passed to the coach inside the next user turn rather
than by editing earlier turns.

Long conversations are condensed automatically (the coach writes its own
summary, which becomes the opening context of the next message) and can be
condensed by hand from Settings.

### Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, `@anthropic-ai/sdk`, Zod.
No icon or markdown libraries: the coach's replies are rendered by a small
Markdown renderer in `lib/markdown.tsx`.

```bash
npm test          # unit tests for tool validation and state updates
npm run typecheck
```
