import { requireUser } from "@/lib/auth";
import { timetableFor } from "@/lib/repo";
import { all } from "@/lib/db";
import { fmtClock } from "@/lib/time";
import { PageTitle, Card, SectionHeading, Button, EmptyState } from "@/components/ui";
import TimetableImport from "@/components/TimetableImport";
import {
  createTimetableEntryAction, deleteTimetableEntryAction,
  uploadTimetableFileAction, deleteTimetableUploadAction,
} from "@/app/actions";
import { IconUpload } from "@/components/icons";

export const metadata = { title: "Timetable" };
export const dynamic = "force-dynamic";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function TimetablePage() {
  const user = await requireUser();
  const [entries, uploads] = await Promise.all([
    timetableFor(user.id),
    all<{ id: number; filename: string; mime: string; created_at: string }>(
      "SELECT id, filename, mime, created_at FROM timetable_uploads WHERE user_id=? ORDER BY id DESC",
      [user.id]
    ),
  ]);

  const byDay = new Map<number, typeof entries>();
  for (const e of entries) {
    const arr = byDay.get(e.day_of_week) ?? [];
    arr.push(e);
    byDay.set(e.day_of_week, arr);
  }

  return (
    <div className="fade-up">
      <PageTitle
        title="Timetable"
        subtitle="Your recurring week. Pull any day into the daily planner with one tap from Today."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHeading>Your week</SectionHeading>
          {entries.length === 0 ? (
            <EmptyState
              title="No timetable yet"
              hint="Add classes or work blocks manually, or paste your timetable text on the right."
            />
          ) : (
            <div className="space-y-3">
              {DAYS.map((day, di) => {
                const list = byDay.get(di);
                if (!list?.length) return null;
                return (
                  <Card key={day} pad={false}>
                    <p className="border-b border-line px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
                      {day}
                    </p>
                    <ul className="divide-y divide-line">
                      {list.map((e) => (
                        <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                          <span className="w-24 shrink-0 tabular-nums text-ink-2">
                            {fmtClock(e.start_min)}–{fmtClock(e.end_min)}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                          {e.location && <span className="truncate text-xs text-ink-3">{e.location}</span>}
                          <form action={deleteTimetableEntryAction}>
                            <input type="hidden" name="id" value={e.id} />
                            <button className="rounded p-1 text-ink-3 opacity-0 hover:text-danger group-hover:opacity-100 max-md:opacity-100" aria-label="Delete entry">×</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          )}

          <SectionHeading>Add an entry</SectionHeading>
          <Card>
            <form action={createTimetableEntryAction} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-3">Day</span>
                <select name="day_of_week">
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-3">From</span>
                <input name="start_time" type="time" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-3">To</span>
                <input name="end_time" type="time" required />
              </label>
              <label className="col-span-2 block sm:col-span-1">
                <span className="mb-1 block text-[11px] text-ink-3">Title</span>
                <input name="title" required placeholder="e.g. Lecture" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-3">Location</span>
                <input name="location" placeholder="optional" />
              </label>
              <div className="flex items-end">
                <Button className="w-full">Add</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <SectionHeading>Import from text</SectionHeading>
          <Card>
            <TimetableImport />
          </Card>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Honest note: this app can't reliably OCR a photo by itself. Upload your timetable
            below to keep it handy, then paste the text version (or type it) and the app will
            structure it for you — you review everything before it's saved.
          </p>

          <SectionHeading>Uploaded files</SectionHeading>
          <Card>
            <form action={uploadTimetableFileAction} className="flex flex-wrap items-center gap-2">
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf"
                className="flex-1 text-xs" required />
              <Button variant="soft"><IconUpload size={14} /> Upload</Button>
            </form>
            {uploads.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {uploads.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2 text-sm">
                    <a href={`/api/timetable-file/${u.id}`} target="_blank"
                      className="min-w-0 flex-1 truncate font-medium text-accent-ink hover:underline">
                      {u.filename}
                    </a>
                    <span className="text-xs text-ink-3">{u.mime.split("/")[1]}</span>
                    <form action={deleteTimetableUploadAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="rounded p-1 text-ink-3 hover:text-danger" aria-label="Delete file">×</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
