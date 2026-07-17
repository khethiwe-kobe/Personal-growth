# Selah — Personal Growth

A calm, minimal personal dashboard for growing spiritually, mentally and physically:
Bible reading plan (New Testament first, finishing 30 November, lighter Sundays, self-adjusting),
chapter notes, scripture memory with spaced repetition, prayer journal, a "Renewing My Mind"
truth database, a large Scripture Library (topics, situations, Bible stories, search, truth
cards, PDF teaching uploads), workouts, meals, habits, goals, vision board, reflections,
analytics, and a rule-based Companion that encourages you from your own data.

Built with Next.js, TypeScript and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where your data lives

The app is **local-first**: everything is stored in your browser (localStorage, plus
IndexedDB for images) and persists between sessions automatically. Nothing leaves your
device unless you enable cloud sync. Use **Settings → Backup & restore** to download or
restore a JSON backup at any time.

## Optional: cloud sync with Supabase

1. Create a free project at https://supabase.com.
2. In the SQL editor, run the contents of `supabase/schema.sql`.
3. In **Authentication → Providers**, make sure Email (magic link) is enabled.
4. Create `.env.local` in the project root:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

5. Restart the dev server. **Settings → Cloud sync** now offers sign-in,
   "Back up now" and "Restore from cloud".

## Optional: Re:amaze support integration

Server-side integration with the [Re:amaze](https://www.reamaze.com/api) support
platform. The API token is a **secret** and is only ever used on the server — it
never reaches the browser.

1. In `.env.local` add:

   ```
   REAMAZE_BRAND=serentia-shop          # the {brand} in {brand}.reamaze.io
   REAMAZE_LOGIN_EMAIL=you@example.com  # login email the token belongs to
   REAMAZE_API_TOKEN=your-secret-token  # from Re:amaze → Settings → Developer/API
   ```

2. The endpoint is `app/api/reamaze/route.api.ts`, backed by the typed client in
   `lib/reamaze.ts`:
   - `GET /api/reamaze` — returns `{ configured, ok }`; a token health check.
   - `POST /api/reamaze` with `{ name, email, subject, message }` — opens a
     support conversation.

3. This route needs a Node server, so run it with `npm run dev`, `npm start`, or
   deploy to a server host (e.g. Vercel). The static **GitHub Pages** export does
   not include it — `output: export` can't serve server routes, so `route.api.ts`
   is registered as a route only for server builds (see `next.config.ts`).

If a token is ever exposed, rotate it in Re:amaze and update `.env.local`.

## Deploying

**GitHub Pages (already set up):** `.github/workflows/deploy-pages.yml` builds a static
export and deploys it to GitHub Pages on every push to the development branch. The live
site is served at `https://<owner>.github.io/Personal-growth/`. Notes:

- GitHub Pages requires the repository to be **public** (or a paid GitHub plan for
  private repos). If the deploy fails with a Pages-availability error, make the repo
  public under Settings → General, then re-run the workflow from the Actions tab.
- `DEPLOY_TARGET=pages npm run build` reproduces the same static bundle locally in `out/`.

Any other Next.js host also works (Vercel is simplest: import the repo, add the two env
vars, deploy).

## Structure

- `app/` — one route per section (bible, library, memory, prayer, renew, workouts, meals,
  habits, goals, vision, reflection, analytics, settings)
- `components/` — shared UI primitives (`ui.tsx`), charts (`viz.tsx`), navigation (`Shell.tsx`)
- `lib/` — domain logic: reading-plan engine (`bible.ts`), storage layer (`storage.ts`),
  scripture-reference extraction (`refs.ts`), companion insights (`companion.ts`)
- `lib/data/` — the Scripture Library content (94 topics, 22 stories, 14 situations,
  quotes and affirmations; verse text is the World English Bible, public domain)
- `supabase/schema.sql` — table + row-level security for optional cloud backup
