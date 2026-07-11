"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageTitle, SectionTitle, Stat, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { MemoryVerse } from "@/lib/types";
import { addDays, formatShort, todayISO, uid } from "@/lib/dates";

// Spaced repetition intervals (days). "Got it" advances, "Struggled" resets to the start.
const STEPS = [1, 3, 7, 14, 30, 60, 120];

export default function MemoryPage() {
  const [verses, setVerses] = useStore<MemoryVerse[]>("memory", []);
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const [practicing, setPracticing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const today = todayISO();
  const due = verses.filter((v) => !v.memorized && v.nextReview <= today);
  const learning = verses.filter((v) => !v.memorized);
  const memorized = verses.filter((v) => v.memorized);

  function add() {
    if (!ref.trim() || !text.trim()) return;
    setVerses((prev) => [
      {
        id: uid(),
        ref: ref.trim(),
        text: text.trim(),
        addedAt: today,
        memorized: false,
        nextReview: today,
        intervalDays: 0,
        lapses: 0,
      },
      ...prev,
    ]);
    setRef("");
    setText("");
  }

  function review(v: MemoryVerse, gotIt: boolean) {
    setVerses((prev) =>
      prev.map((x) => {
        if (x.id !== v.id) return x;
        const idx = STEPS.indexOf(x.intervalDays);
        const nextInterval = gotIt ? STEPS[Math.min(idx + 1, STEPS.length - 1)] : STEPS[0];
        return {
          ...x,
          intervalDays: nextInterval,
          lastReviewed: today,
          nextReview: addDays(today, nextInterval),
          lapses: gotIt ? x.lapses : x.lapses + 1,
        };
      })
    );
    setPracticing(null);
    setRevealed(false);
  }

  function toggleMemorized(v: MemoryVerse) {
    setVerses((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, memorized: !x.memorized, nextReview: x.memorized ? today : addDays(today, 30) } : x))
    );
  }

  const current = verses.find((v) => v.id === practicing);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Scripture Memory"
        subtitle="Hide the Word in your heart. Verses come back for review on a spaced-repetition rhythm — more often while young, rarely once established."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Due today" value={due.length} />
        <Stat label="In training" value={learning.length} />
        <Stat label="Memorized" value={memorized.length} />
      </div>

      <Card className="mt-6">
        <SectionTitle>Add a verse</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Reference">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Philippians 4:13" />
          </Field>
          <Field label="Verse text">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="I can do all things through Christ which strengtheneth me." />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add} disabled={!ref.trim() || !text.trim()}>
            Add verse
          </Button>
        </div>
      </Card>

      {current && (
        <Card className="mt-6 border-brown-faint bg-beige/40">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Practice</p>
          <p className="mt-2 font-display text-2xl text-ink">{current.ref}</p>
          {revealed ? (
            <p className="mt-3 font-display text-lg leading-relaxed text-soft">&ldquo;{current.text}&rdquo;</p>
          ) : (
            <p className="mt-3 text-sm text-faint">Say the verse aloud from memory, then reveal to check yourself.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {!revealed ? (
              <Button onClick={() => setRevealed(true)}>Reveal</Button>
            ) : (
              <>
                <Button onClick={() => review(current, true)}>Got it</Button>
                <Button variant="ghost" onClick={() => review(current, false)}>
                  Struggled
                </Button>
              </>
            )}
            <Button variant="quiet" onClick={() => { setPracticing(null); setRevealed(false); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <section className="mt-8">
        <SectionTitle>Due for review</SectionTitle>
        {due.length === 0 ? (
          <EmptyState title="Nothing due today." hint="Verses will reappear here when it is time to review them." />
        ) : (
          <div className="space-y-2">
            {due.map((v) => (
              <Card key={v.id} className="flex items-center justify-between gap-4 p-4 sm:p-4">
                <div>
                  <p className="font-display text-lg text-ink">{v.ref}</p>
                  <p className="text-xs text-faint">
                    interval {v.intervalDays || "new"}d{v.lapses > 0 ? ` · ${v.lapses} lapses` : ""}
                  </p>
                </div>
                <Button onClick={() => setPracticing(v.id)}>Practice</Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>All verses</SectionTitle>
        {verses.length === 0 ? (
          <EmptyState title="No verses yet." hint="Add your first memory verse above." />
        ) : (
          <div className="space-y-2">
            {verses.map((v) => (
              <Card key={v.id} className="p-4 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-ink">
                      {v.ref} {v.memorized && <Tag tone="sage">memorized</Tag>}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-soft">&ldquo;{v.text}&rdquo;</p>
                    <p className="mt-1 text-xs text-faint">
                      {v.memorized ? `review ${formatShort(v.nextReview)}` : `next review ${formatShort(v.nextReview)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" onClick={() => setPracticing(v.id)}>
                      Practice
                    </Button>
                    <Button variant="ghost" onClick={() => toggleMemorized(v)}>
                      {v.memorized ? "Back to training" : "Mark memorized"}
                    </Button>
                    <Button variant="quiet" onClick={() => setVerses((prev) => prev.filter((x) => x.id !== v.id))}>
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
