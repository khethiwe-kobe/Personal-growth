"use client";

import { useMemo, useState } from "react";
import { Button, Card, Check, EmptyState, Field, Modal, PageTitle, ProgressBar, SectionTitle, Stat, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { BibleNote, BibleProgress, ChapterActivity } from "@/lib/types";
import { ALL_BOOKS, NT_BOOKS, NT_CHAPTERS, OT_BOOKS, bibleStats, isChapterDone, todaysReading } from "@/lib/bible";
import { formatLong, formatShort, todayISO } from "@/lib/dates";

const EMPTY_NOTE = (id: string): BibleNote => ({
  chapterId: id,
  observations: "",
  lessons: "",
  questions: "",
  application: "",
  prayer: "",
  updatedAt: "",
});

export default function BiblePage() {
  const [progress, setProgress] = useStore<BibleProgress>("bible", {});
  const [notes, setNotes] = useStore<Record<string, BibleNote>>("bibleNotes", {});
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const stats = useMemo(() => bibleStats(progress), [progress]);
  const reading = useMemo(() => todaysReading(progress), [progress]);
  const doneToday = reading.length === 0;

  function toggle(id: string, field: keyof ChapterActivity) {
    setProgress((prev) => {
      const cur = { ...(prev[id] || {}) };
      const next = !cur[field];
      (cur as Record<string, unknown>)[field] = next;
      if (next && !cur.date) cur.date = todayISO();
      if (!cur.read && !cur.listened && !cur.studied) delete cur.date;
      return { ...prev, [id]: cur };
    });
  }

  function saveNote(id: string, patch: Partial<BibleNote>) {
    setNotes((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || EMPTY_NOTE(id)), ...patch, updatedAt: todayISO() },
    }));
  }

  const note = openChapter ? notes[openChapter] || EMPTY_NOTE(openChapter) : null;
  const activity: ChapterActivity = (openChapter && progress[openChapter]) || {};

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Bible Reading"
        subtitle={`New Testament first, then the Old — finishing by ${formatLong(stats.deadline)}. The plan recalculates every day from what you have actually read, with lighter Sundays for church.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Complete" value={`${stats.pct}%`} hint={`${stats.completed} of ${stats.total} chapters`} />
        <Stat label="Days remaining" value={stats.daysRemaining} hint={`until ${formatShort(stats.deadline)}`} />
        <Stat
          label="Estimated finish"
          value={stats.estimatedFinish ? formatShort(stats.estimatedFinish) : "—"}
          hint={stats.completed === 0 ? "start reading to see" : stats.onTrack ? "on track" : "behind pace"}
        />
        <Stat label="Reading streak" value={`${stats.streak}d`} hint="consecutive days" />
        <Stat label="Pace needed" value={stats.paceNeeded.toFixed(1)} hint="chapters per weekday" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm text-soft">New Testament</p>
            <p className="text-sm text-ink">
              {stats.ntCompleted} / {NT_CHAPTERS}
            </p>
          </div>
          <ProgressBar value={(stats.ntCompleted / NT_CHAPTERS) * 100} />
          <div className="mb-2 mt-4 flex items-baseline justify-between">
            <p className="text-sm text-soft">Whole Bible</p>
            <p className="text-sm text-ink">
              {stats.completed} / {stats.total}
            </p>
          </div>
          <ProgressBar value={stats.pct} />
        </Card>
        <Card>
          <div className="flex h-full items-center justify-around text-center">
            <div>
              <p className="font-display text-3xl text-ink">{stats.thisWeek}</p>
              <p className="mt-1 text-xs text-faint">chapters this week</p>
            </div>
            <div className="h-12 w-px bg-line" />
            <div>
              <p className="font-display text-3xl text-ink">{stats.thisMonth}</p>
              <p className="mt-1 text-xs text-faint">chapters this month</p>
            </div>
            <div className="h-12 w-px bg-line" />
            <div>
              <p className="font-display text-3xl text-ink">{stats.recentPace.toFixed(1)}</p>
              <p className="mt-1 text-xs text-faint">recent pace / day</p>
            </div>
          </div>
        </Card>
      </div>

      <section className="mt-10">
        <SectionTitle>
          Today&apos;s reading
          {reading.length > 0 && <span className="ml-2 text-sm font-normal text-faint">({reading.length} chapters)</span>}
        </SectionTitle>
        {doneToday ? (
          <Card>
            <p className="text-sm text-soft">
              {stats.completed >= stats.total
                ? "You have finished the whole Bible. Well done, good and faithful servant."
                : "Nothing assigned — you are ahead of plan. Feel free to keep reading below."}
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-line-soft p-0 sm:p-0">
            {reading.map((id) => {
              const a = progress[id] || {};
              return (
                <div key={id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
                  <button
                    onClick={() => setOpenChapter(id)}
                    className={`min-w-36 text-left font-display text-lg transition-colors hover:text-brown ${isChapterDone(a) ? "text-faint line-through decoration-line" : "text-ink"}`}
                  >
                    {id}
                  </button>
                  <div className="flex gap-5">
                    <Check checked={!!a.read} onChange={() => toggle(id, "read")} label="Read" />
                    <Check checked={!!a.listened} onChange={() => toggle(id, "listened")} label="Listened" />
                    <Check checked={!!a.studied} onChange={() => toggle(id, "studied")} label="Studied" />
                  </div>
                  <button onClick={() => setOpenChapter(id)} className="ml-auto text-xs text-faint underline-offset-2 hover:text-brown hover:underline">
                    {notes[id]?.updatedAt ? "Edit notes" : "Add notes"}
                  </button>
                </div>
              );
            })}
          </Card>
        )}
        {!doneToday && stats.recentPace < stats.paceNeeded && stats.completed > 0 && (
          <p className="mt-2 text-xs text-faint">
            The plan has adjusted for where you are — finish today&apos;s portion and tomorrow&apos;s will ease.
          </p>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>All books</SectionTitle>
        <p className="mb-4 text-sm text-soft">
          Open any book to mark chapters — jump ahead whenever you finish early. Squares fill as chapters are completed.
        </p>
        {[
          { label: "New Testament", books: NT_BOOKS },
          { label: "Old Testament", books: OT_BOOKS },
        ].map((sec) => (
          <div key={sec.label} className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-faint">{sec.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sec.books.map((b) => {
                const done = Array.from({ length: b.chapters }, (_, i) => `${b.name} ${i + 1}`).filter((id) =>
                  isChapterDone(progress[id])
                ).length;
                const open = openBook === b.name;
                return (
                  <Card key={b.name} className="p-4 sm:p-4">
                    <button className="flex w-full items-center justify-between" onClick={() => setOpenBook(open ? null : b.name)}>
                      <span className="font-display text-base text-ink">{b.name}</span>
                      <span className="flex items-center gap-3">
                        {done === b.chapters ? (
                          <Tag tone="brown">complete</Tag>
                        ) : (
                          <span className="text-xs text-faint">
                            {done}/{b.chapters}
                          </span>
                        )}
                      </span>
                    </button>
                    <ProgressBar value={(done / b.chapters) * 100} className="mt-2 h-1" />
                    {open && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Array.from({ length: b.chapters }, (_, i) => {
                          const id = `${b.name} ${i + 1}`;
                          const d = isChapterDone(progress[id]);
                          return (
                            <button
                              key={id}
                              onClick={() => setOpenChapter(id)}
                              title={id}
                              className={`h-8 w-8 rounded-lg border text-xs transition-colors ${
                                d
                                  ? "border-brown bg-brown text-white"
                                  : "border-line bg-card text-soft hover:border-brown-faint"
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <Modal open={!!openChapter} onClose={() => setOpenChapter(null)} title={openChapter ?? ""} wide>
        {openChapter && note && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-6 rounded-2xl bg-beige/60 px-4 py-3">
              <Check checked={!!activity.read} onChange={() => toggle(openChapter, "read")} label="Read" />
              <Check checked={!!activity.listened} onChange={() => toggle(openChapter, "listened")} label="Listened" />
              <Check checked={!!activity.studied} onChange={() => toggle(openChapter, "studied")} label="Studied" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Personal observations">
                <Textarea value={note.observations} onChange={(e) => saveNote(openChapter, { observations: e.target.value })} placeholder="What did you notice?" />
              </Field>
              <Field label="Lessons learned">
                <Textarea value={note.lessons} onChange={(e) => saveNote(openChapter, { lessons: e.target.value })} placeholder="What is God teaching you?" />
              </Field>
              <Field label="Questions">
                <Textarea value={note.questions} onChange={(e) => saveNote(openChapter, { questions: e.target.value })} placeholder="What do you want to study further?" />
              </Field>
              <Field label="Application">
                <Textarea value={note.application} onChange={(e) => saveNote(openChapter, { application: e.target.value })} placeholder="How will you live this out?" />
              </Field>
            </div>
            <Field label="Prayer">
              <Textarea value={note.prayer} onChange={(e) => saveNote(openChapter, { prayer: e.target.value })} placeholder="Turn this chapter into prayer." />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => setOpenChapter(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
