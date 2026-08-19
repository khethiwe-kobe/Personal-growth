"use client";

import { useActionState, useRef, useState } from "react";
import { createGoalAction } from "@/app/actions";
import type { CategoryRow } from "@/lib/types";
import { Button } from "./ui";

/**
 * Guided goal creation: every step forces the goal to become measurable.
 * The whole thing is one form — steps only control visibility, so all
 * values submit together at the end.
 */

const STEPS = [
  "The goal", "Why it matters", "How it's measured", "Targets & rhythm", "Follow-through",
] as const;

const TRACKING: { v: string; label: string; hint: string }[] = [
  { v: "number", label: "Number", hint: "e.g. 3 chapters, 20 pages" },
  { v: "time", label: "Time", hint: "minutes spent, e.g. 120 min" },
  { v: "frequency", label: "Frequency", hint: "sessions per week, e.g. 4 workouts" },
  { v: "boolean", label: "Yes / No", hint: "did it or didn't" },
  { v: "quantity", label: "Quantity", hint: "items produced or saved" },
  { v: "percent", label: "Percentage", hint: "e.g. 80% average" },
  { v: "streak", label: "Streak", hint: "consecutive days matter most" },
  { v: "custom", label: "Custom", hint: "your own unit" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function GoalWizard({ categories }: { categories: CategoryRow[] }) {
  const [state, action, pending] = useActionState(createGoalAction, null as { error?: string } | null);
  const [step, setStep] = useState(0);
  const [tracking, setTracking] = useState("number");
  const [frequency, setFrequency] = useState("daily");
  const isBool = tracking === "boolean";

  const formRef = useRef<HTMLFormElement>(null);
  const next = () => {
    // Validate the visible step's fields before advancing.
    const form = formRef.current;
    if (form) {
      const stepEl = form.querySelector<HTMLElement>(`[data-step="${step}"]`);
      const fields = stepEl?.querySelectorAll<HTMLInputElement>("input, textarea, select") ?? [];
      for (const f of fields) {
        if (!f.checkValidity()) { f.reportValidity(); return; }
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <form ref={formRef} action={action} className="mx-auto max-w-xl">
      {/* progress */}
      <ol className="mb-6 flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`h-1.5 w-full rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-[var(--ring-track)]"
              }`}
              aria-label={`Step ${i + 1}: ${label}`}
            />
          </li>
        ))}
      </ol>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="mb-5 font-display text-2xl font-medium">{STEPS[step]}</h2>

      {/* Step 1 — goal + category */}
      <div data-step="0" className={step === 0 ? "space-y-4" : "hidden"}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">What do you want to achieve?</span>
          <input name="title" placeholder="e.g. Read the Bible daily" required maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Which area of life?</span>
          <select name="category_id" defaultValue="">
            <option value="">General</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-ink-3">
            You can add your own categories in Settings.
          </span>
        </label>
      </div>

      {/* Step 2 — why */}
      <div data-step="1" className={step === 1 ? "space-y-4" : "hidden"}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Why is this important to you?</span>
          <textarea name="why" rows={4}
            placeholder="When it gets hard, this is what you'll come back to. Only you will ever see it." />
          <span className="mt-1 block text-xs text-ink-3">Private — never shared with your group.</span>
        </label>
      </div>

      {/* Step 3 — measurement */}
      <div data-step="2" className={step === 2 ? "space-y-4" : "hidden"}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">How will we know you achieved it?</span>
          <input name="measurement" placeholder="e.g. Chapters read, logged every morning" />
        </label>
        <div>
          <span className="mb-2 block text-sm font-medium">How should it be tracked?</span>
          <div className="grid grid-cols-2 gap-2">
            {TRACKING.map((t) => (
              <label key={t.v}
                className={`cursor-pointer rounded-xl border p-3 ${
                  tracking === t.v ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
                }`}>
                <input type="radio" name="tracking_type" value={t.v} className="sr-only"
                  checked={tracking === t.v} onChange={() => setTracking(t.v)} />
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-ink-3">{t.hint}</span>
              </label>
            ))}
          </div>
        </div>
        {!isBool && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Unit</span>
            <input name="unit" placeholder={tracking === "time" ? "min" : "e.g. chapters, sessions, R"} maxLength={30} />
          </label>
        )}
      </div>

      {/* Step 4 — targets */}
      <div data-step="3" className={step === 3 ? "space-y-4" : "hidden"}>
        <div>
          <span className="mb-2 block text-sm font-medium">How often must you work on it?</span>
          <div className="flex gap-2">
            {(["daily", "weekly", "monthly"] as const).map((f) => (
              <label key={f}
                className={`flex-1 cursor-pointer rounded-xl border p-3 text-center text-sm font-medium capitalize ${
                  frequency === f ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
                }`}>
                <input type="radio" name="frequency" value={f} className="sr-only"
                  checked={frequency === f} onChange={() => setFrequency(f)} />
                {f}
              </label>
            ))}
          </div>
        </div>
        {!isBool && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Exact target per {frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month"}
            </span>
            <input name="period_target" type="number" step="any" min={0.1}
              placeholder="e.g. 3" required={!isBool} />
          </label>
        )}
        {isBool && <input type="hidden" name="period_target" value="1" />}
        {!isBool && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Minimum acceptable (optional)</span>
            <input name="minimum_target" type="number" step="any" min={0}
              placeholder="the bare minimum on a bad day" />
            <span className="mt-1 block text-xs text-ink-3">
              A floor for hard days — it won't count as a full completion, but the app will show you kept the habit alive.
            </span>
          </label>
        )}
        {!isBool && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Overall cumulative target (optional)</span>
            <input name="overall_target" type="number" step="any" min={0}
              placeholder="e.g. save R30 000 in total" />
          </label>
        )}
        {frequency === "daily" && (
          <div>
            <span className="mb-2 block text-sm font-medium">Which days count?</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="active_days" value={i} defaultChecked className="peer sr-only" />
                  <span className="inline-block rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink">
                    {d}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Deadline (optional)</span>
          <input name="deadline" type="date" />
          <span className="mt-1 block text-xs text-ink-3">Leave empty for an ongoing habit.</span>
        </label>
      </div>

      {/* Step 5 — follow-through */}
      <div data-step="4" className={step === 4 ? "space-y-4" : "hidden"}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            What action moves you toward this every {frequency === "daily" ? "day" : "week"}?
          </span>
          <input name="daily_action" placeholder="e.g. Read 3 chapters before checking my phone" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">How will you prove/record it?</span>
          <input name="evidence" placeholder="e.g. Log it here right after finishing" />
          <span className="mt-1 block text-xs text-ink-3">Private — for your own honesty.</span>
        </label>
        <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
          <input type="checkbox" name="share_progress" defaultChecked className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium">Share progress with my group</span>
            <span className="block text-xs text-ink-3">
              They see the title, percentages and streaks — never your why, notes or evidence.
            </span>
          </span>
        </label>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" type="button" onClick={back} disabled={step === 0}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" type="button" onClick={next}>Continue</Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {pending ? "Creating…" : "Create goal"}
          </Button>
        )}
      </div>
    </form>
  );
}
