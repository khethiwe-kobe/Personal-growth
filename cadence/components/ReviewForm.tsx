"use client";

import { useState, useTransition } from "react";
import { saveReviewAction } from "@/app/actions";
import { Button, Card, SectionHeading } from "./ui";
import { useRouter } from "next/navigation";

type Section = { key: string; title: string; prompts: string[] };
type QA = { key: string; q: string };

export default function ReviewForm({
  month, sections, reflections, yesNo, initial,
}: {
  month: string;
  sections: Section[];
  reflections: QA[];
  yesNo: QA[];
  initial: Record<string, unknown>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [savedDraft, setSavedDraft] = useState(false);
  const init = initial as {
    ratings?: Record<string, number>;
    yesno?: Record<string, boolean>;
  } & Record<string, string | object | undefined>;

  const [ratings, setRatings] = useState<Record<string, number>>(
    () => ({ ...(init.ratings ?? {}) })
  );
  const [yesno, setYesno] = useState<Record<string, boolean>>(
    () => ({ ...(init.yesno ?? {}) })
  );
  const [text, setText] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {};
    for (const r of reflections) t[r.key] = (init[r.key] as string) ?? "";
    return t;
  });

  const answers = () => ({ ratings, yesno, ...text });
  const save = (submit: boolean) =>
    start(async () => {
      await saveReviewAction(month, answers(), submit);
      if (submit) router.refresh();
      else { setSavedDraft(true); setTimeout(() => setSavedDraft(false), 2500); }
    });

  return (
    <div className="space-y-1">
      {sections.map((s) => (
        <div key={s.key}>
          <SectionHeading>{s.title}</SectionHeading>
          <Card className="space-y-4">
            {s.prompts.map((p, i) => {
              const k = `${s.key}.${i}`;
              const v = ratings[k] ?? 0;
              return (
                <div key={k}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>{p}</span>
                    <span className={`w-10 text-right text-sm font-semibold tabular-nums ${v ? "" : "text-ink-3"}`}>
                      {v || "–"}/10
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={10} step={1} value={v}
                    onChange={(e) => setRatings({ ...ratings, [k]: Number(e.target.value) })}
                    className="!p-0 accent-[var(--accent)]"
                    aria-label={`${p} rating out of 10`}
                  />
                </div>
              );
            })}
          </Card>
        </div>
      ))}

      <SectionHeading>Quick answers</SectionHeading>
      <Card className="space-y-3">
        {yesNo.map((q) => (
          <div key={q.key} className="flex items-center justify-between gap-3 text-sm">
            <span>{q.q}</span>
            <div className="flex gap-1">
              {[true, false].map((val) => (
                <button key={String(val)} type="button"
                  onClick={() => setYesno({ ...yesno, [q.key]: val })}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                    yesno[q.key] === val
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-ink-3 hover:bg-surface-2"
                  }`}>
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <SectionHeading>Reflection</SectionHeading>
      <Card className="space-y-4">
        {reflections.map((r) => (
          <label key={r.key} className="block">
            <span className="mb-1 block text-sm font-medium">{r.q}</span>
            <textarea rows={2} value={text[r.key]}
              onChange={(e) => setText({ ...text, [r.key]: e.target.value })} />
          </label>
        ))}
        <p className="text-[11px] text-ink-3">
          Your written reflections are private. Only your section scores and the app's measured
          numbers feed the shared monthly picture.
        </p>
      </Card>

      <div className="sticky bottom-16 mt-6 flex gap-2 rounded-2xl border border-line bg-surface p-3 md:bottom-4" style={{ boxShadow: "var(--shadow)" }}>
        <Button variant="ghost" type="button" onClick={() => save(false)} disabled={pending}>
          {savedDraft ? "Draft saved" : "Save draft"}
        </Button>
        <Button type="button" className="flex-1" onClick={() => save(true)} disabled={pending}>
          {pending ? "Saving…" : "Submit review"}
        </Button>
      </div>
    </div>
  );
}
