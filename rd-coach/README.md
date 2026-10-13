# RD Coach

A personal strength and conditioning coach for RD preparation, powered by
Google's Gemini API. The coach interviews you in short groups of questions, assesses your
strengths and weaknesses, builds a periodised programme for the weeks you have,
then prescribes each day's session and adjusts it from what you report.

The objective it works towards is capability, not aesthetics: functional
strength, muscular and cardiovascular endurance, explosive power, relative
strength, mobility, core, grip, work capacity and useful muscle.

## Running it

```bash
cd rd-coach
npm install
cp .env.example .env.local   # add GEMINI_API_KEY and COACH_PASSCODE
npm run dev                  # http://localhost:3200
```

### Sharing it

Deploy to Vercel with **Root Directory** `rd-coach` and the **Next.js** preset,
then set these environment variables in the Vercel project:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Key from Google AI Studio. Everyone who uses the app shares its quota. |
| `COACH_PASSCODE` | Passcode people enter once per device. Without it, anyone with the link can use your key. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`. |

Send people the link and the passcode. Each person's profile, programme, log
and progress stay on their own device; nobody can see anyone else's data.
Download backup and Restore from file in Settings move data between devices.

Two things to know about the Gemini free tier: its rate limits are shared by
everyone using your key, and Google's terms for the free tier allow it to use
what is sent to improve its products. Turning on billing for the key's Google
Cloud project lifts both.

## How it is put together

| Area | What it does |
|------|--------------|
| **Coach** | Streaming conversation. Starts with an assessment, moves through analysis and programme design, then daily coaching. Quick actions for "Today's session" and a structured post-session report form. |
| **Programme** | The weekly schedule, periodisation blocks and principles the coach saved. Today's row is highlighted. |
| **Log** | Every reported session: exercises with sets, reps and loads, what felt easy or hard, pain notes, and the coach's note for next time. |
| **Progress** | Baselines and reassessments per test with change and a small trend line; timed efforts count a lower time as an improvement. Profile summary and consistency counts. |
| **Settings** | Forget the passcode on this device, condense or clear the conversation, JSON backup and restore, full reset. |

### Data

Local-first. Everything (profile, programme, log, metrics and the full
transcript) lives in `localStorage` under `rd-coach:v1`. The server keeps
nothing. Download a backup from Settings before clearing site data. Backups
never include the passcode. Conversations saved by the first, Claude-based
version are upgraded on load and keep their text.

### The coach's tools

The model keeps the dashboard current by calling tools during the conversation:
`update_profile`, `record_metric`, `save_programme`, `log_workout` and
`set_phase`. The route handler validates each call (`lib/coach/tools.ts`,
Zod), answers "Saved", and streams the validated input to the browser, which
applies it to the local store (`lib/coach/apply.ts`). The browser stores the
model's turns exactly as Gemini returned them, thought signatures included, so
multi-step tool use keeps its reasoning across requests. Today's date and any
data you edit by hand are passed to the coach inside the next message rather
than by editing earlier turns.

### Passcode

When `COACH_PASSCODE` is set, a passcode screen appears on first visit. The
server checks the passcode on every coach request (`lib/server/auth.ts`), with
a constant-time comparison and a short delay on wrong guesses. Pick something
longer than a PIN.

Long conversations are condensed automatically (the coach writes its own
summary, which becomes the opening context of the next message) and can be
condensed by hand from Settings.

### Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, `@google/genai`, Zod.
No icon or markdown libraries: the coach's replies are rendered by a small
Markdown renderer in `lib/markdown.tsx`.

```bash
npm test          # unit tests: tools, state updates, transcripts, passcode
npm run typecheck
```
