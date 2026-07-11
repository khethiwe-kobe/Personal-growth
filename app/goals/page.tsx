"use client";

import { useState } from "react";
import { Button, Card, Check, EmptyState, Field, Input, Modal, PageTitle, ProgressBar, SectionTitle, Select, Stat, Tabs, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { Goal, GoalHorizon, GoalStatus } from "@/lib/types";
import { formatShort, todayISO, uid } from "@/lib/dates";

const HORIZONS: { id: GoalHorizon; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
  { id: "longterm", label: "Long-term" },
];

const STATUS_LABEL: Record<GoalStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
  "on-hold": "On hold",
};

const CATEGORIES = ["Faith", "Health", "Career", "Relationships", "Finances", "Personal Growth", "Other"];

function goalProgress(g: Goal): number {
  if (g.status === "completed") return 100;
  if (!g.milestones.length) return 0;
  return Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100);
}

export default function GoalsPage() {
  const [goals, setGoals] = useStore<Goal[]>("goals", []);
  const [tab, setTab] = useState<string>("all");
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = goals.filter((g) => tab === "all" || g.horizon === tab);
  const completed = goals.filter((g) => g.status === "completed").length;

  function upsert(goal: Goal) {
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === goal.id);
      return exists ? prev.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...prev];
    });
    setEditing(null);
    setCreating(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Goals"
        subtitle="Write the vision and make it plain. SMART goals — specific, measurable, achievable, relevant, time-bound — with milestones that add up to progress."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Active goals" value={goals.length - completed} />
        <Stat label="Completed" value={completed} />
        <Stat
          label="Average progress"
          value={`${goals.length ? Math.round(goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length) : 0}%`}
        />
      </div>

      <div className="mt-8 flex items-start justify-between gap-4">
        <Tabs tabs={[{ id: "all", label: "All" }, ...HORIZONS]} active={tab} onChange={setTab} />
        <Button onClick={() => setCreating(true)}>New goal</Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No goals here yet." hint="A goal with a date is a decision; without one it stays a wish." />
      ) : (
        <div className="space-y-3">
          {visible.map((g) => (
            <Card key={g.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg text-ink">{g.title}</p>
                    <Tag>{HORIZONS.find((h) => h.id === g.horizon)?.label}</Tag>
                    <Tag tone={g.status === "completed" ? "sage" : g.status === "in-progress" ? "brown" : "beige"}>
                      {STATUS_LABEL[g.status]}
                    </Tag>
                  </div>
                  {g.description && <p className="mt-1 text-sm leading-relaxed text-soft">{g.description}</p>}
                  {g.why && <p className="mt-1 text-sm italic text-faint">Why: {g.why}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl text-ink">{goalProgress(g)}%</p>
                  {g.targetDate && <p className="text-xs text-faint">by {formatShort(g.targetDate)}</p>}
                </div>
              </div>
              <ProgressBar value={goalProgress(g)} className="mt-3" />
              {g.milestones.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {g.milestones.map((m) => (
                    <li key={m.id}>
                      <Check
                        checked={m.done}
                        onChange={() =>
                          upsertMilestone(setGoals, g.id, m.id)
                        }
                        label={m.title}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(g)}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GoalModal open={creating || !!editing} initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSave={upsert} />
    </div>
  );
}

function upsertMilestone(
  setGoals: (fn: (prev: Goal[]) => Goal[]) => void,
  goalId: string,
  milestoneId: string
) {
  setGoals((prev) =>
    prev.map((g) => {
      if (g.id !== goalId) return g;
      const milestones = g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
      const allDone = milestones.length > 0 && milestones.every((m) => m.done);
      return {
        ...g,
        milestones,
        status: allDone ? "completed" : g.status === "completed" ? "in-progress" : g.status === "not-started" ? "in-progress" : g.status,
      };
    })
  );
}

function GoalModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Goal | null;
  onClose: () => void;
  onSave: (g: Goal) => void;
}) {
  const blank: Goal = {
    id: "",
    title: "",
    description: "",
    why: "",
    category: "Personal Growth",
    horizon: "monthly",
    targetDate: "",
    milestones: [],
    status: "not-started",
    reflection: "",
    lessons: "",
    createdAt: todayISO(),
  };
  const [draft, setDraft] = useState<Goal>(blank);
  const [milestone, setMilestone] = useState("");
  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  // Re-seed the form when a different goal is opened
  const seedKey = initial?.id ?? (open ? "new" : "closed");
  if (open && seededFrom !== seedKey) {
    setDraft(initial ? { ...initial } : { ...blank, id: uid() });
    setSeededFrom(seedKey);
  }
  if (!open && seededFrom !== "closed") setSeededFrom("closed");

  const set = (patch: Partial<Goal>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit goal" : "New goal"} wide>
      <div className="space-y-4">
        <Field label="Title — specific and measurable">
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Read the whole New Testament" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Horizon">
            <Select value={draft.horizon} onChange={(e) => set({ horizon: e.target.value as GoalHorizon })}>
              {HORIZONS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Target date — time-bound">
            <Input type="date" value={draft.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What exactly will be true when this is done?" />
        </Field>
        <Field label="Why it matters — relevant">
          <Textarea rows={2} value={draft.why} onChange={(e) => set({ why: e.target.value })} placeholder="Connect it to what God is doing in you." />
        </Field>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Milestones — achievable steps</p>
          <div className="flex gap-2">
            <Input
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder="Add a milestone"
              onKeyDown={(e) => {
                if (e.key === "Enter" && milestone.trim()) {
                  set({ milestones: [...draft.milestones, { id: uid(), title: milestone.trim(), done: false }] });
                  setMilestone("");
                }
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                if (!milestone.trim()) return;
                set({ milestones: [...draft.milestones, { id: uid(), title: milestone.trim(), done: false }] });
                setMilestone("");
              }}
            >
              Add
            </Button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {draft.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <Check
                  checked={m.done}
                  onChange={() => set({ milestones: draft.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}
                  label={m.title}
                />
                <Button variant="quiet" onClick={() => set({ milestones: draft.milestones.filter((x) => x.id !== m.id) })}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set({ status: e.target.value as GoalStatus })}>
              {Object.entries(STATUS_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reflection">
            <Textarea rows={2} value={draft.reflection} onChange={(e) => set({ reflection: e.target.value })} placeholder="How is it going?" />
          </Field>
          <Field label="Lessons learned">
            <Textarea rows={2} value={draft.lessons} onChange={(e) => set({ lessons: e.target.value })} placeholder="What has this taught you?" />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => draft.title.trim() && onSave(draft)} disabled={!draft.title.trim()}>
            Save goal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
