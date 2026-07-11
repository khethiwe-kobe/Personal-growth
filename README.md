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

## Deploying

Any Next.js host works (Vercel is simplest: import the repo, add the two env vars if
using Supabase, deploy).

## Structure

- `app/` — one route per section (bible, library, memory, prayer, renew, workouts, meals,
  habits, goals, vision, reflection, analytics, settings)
- `components/` — shared UI primitives (`ui.tsx`), charts (`viz.tsx`), navigation (`Shell.tsx`)
- `lib/` — domain logic: reading-plan engine (`bible.ts`), storage layer (`storage.ts`),
  scripture-reference extraction (`refs.ts`), companion insights (`companion.ts`)
- `lib/data/` — the Scripture Library content (94 topics, 22 stories, 14 situations,
  quotes and affirmations; verse text is KJV, public domain)
- `supabase/schema.sql` — table + row-level security for optional cloud backup
