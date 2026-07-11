"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageTitle, SectionTitle, Select, Stat, Tabs, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { TruthEntry, TruthStage } from "@/lib/types";
import { todayISO, uid } from "@/lib/dates";

const STAGES: { id: TruthStage; label: string; hint: string }[] = [
  { id: "learning", label: "Learning", hint: "newly discovering this truth" },
  { id: "growing", label: "Growing", hint: "practising it in real situations" },
  { id: "established", label: "Established", hint: "it now shapes how you live" },
];

const EMPTY = { lie: "", truth: "", verses: "", action: "" };

export default function RenewPage() {
  const [truths, setTruths] = useStore<TruthEntry[]>("truths", []);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState<string>("all");

  function add() {
    if (!form.lie.trim() || !form.truth.trim()) return;
    const now = todayISOTime();
    setTruths((prev) => [
      {
        id: uid(),
        lie: form.lie.trim(),
        truth: form.truth.trim(),
        verses: form.verses.split(/[;,\n]/).map((v) => v.trim()).filter(Boolean),
        action: form.action.trim(),
        reflection: "",
        victory: "",
        stage: "learning",
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
    setForm(EMPTY);
  }

  function update(id: string, patch: Partial<TruthEntry>) {
    setTruths((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: todayISOTime() } : t)));
  }

  const visible = truths.filter((t) => filter === "all" || t.stage === filter);
  const count = (s: TruthStage) => truths.filter((t) => t.stage === s).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Renewing My Mind"
        subtitle="Be transformed by the renewing of your mind (Romans 12:2). Name the lie, answer it with God's truth, act on it, and record the victory."
      />

      <div className="grid grid-cols-3 gap-3">
        {STAGES.map((s) => (
          <Stat key={s.id} label={s.label} value={count(s.id)} hint={s.hint} />
        ))}
      </div>

      <Card className="mt-6">
        <SectionTitle>New truth exchange</SectionTitle>
        <div className="space-y-4">
          <Field label="Negative belief — the lie">
            <Textarea rows={2} value={form.lie} onChange={(e) => setForm({ ...form, lie: e.target.value })} placeholder="What have you been believing that is not true?" />
          </Field>
          <div className="pl-4 text-xs text-faint">exchanged for</div>
          <Field label="Truth from Scripture">
            <Textarea rows={2} value={form.truth} onChange={(e) => setForm({ ...form, truth: e.target.value })} placeholder="What does God say instead?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supporting verses (comma separated)">
              <Input value={form.verses} onChange={(e) => setForm({ ...form, verses: e.target.value })} placeholder="Romans 8:1, Ephesians 1:6" />
            </Field>
            <Field label="Action I will take">
              <Input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="How will you act on this truth?" />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={add} disabled={!form.lie.trim() || !form.truth.trim()}>
            Add to my truths
          </Button>
        </div>
      </Card>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>My growing database of truth</SectionTitle>
        </div>
        <Tabs
          tabs={[{ id: "all", label: `All (${truths.length})` }, ...STAGES.map((s) => ({ id: s.id, label: `${s.label} (${count(s.id)})` }))]}
          active={filter}
          onChange={setFilter}
        />
        {visible.length === 0 ? (
          <EmptyState title="Nothing here yet." hint="Add your first lie-for-truth exchange above." />
        ) : (
          <div className="space-y-3">
            {visible.map((t) => (
              <Card key={t.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-faint line-through decoration-brown-faint/60">{t.lie}</p>
                    <p className="mt-1.5 font-display text-lg leading-relaxed text-ink">{t.truth}</p>
                    {t.verses.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {t.verses.map((v, i) => (
                          <Tag key={i}>{v}</Tag>
                        ))}
                      </p>
                    )}
                  </div>
                  <Select
                    value={t.stage}
                    onChange={(e) => update(t.id, { stage: e.target.value as TruthStage })}
                    className="!w-auto"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Action">
                    <Textarea rows={2} value={t.action} onChange={(e) => update(t.id, { action: e.target.value })} placeholder="What will you do?" />
                  </Field>
                  <Field label="Reflection">
                    <Textarea rows={2} value={t.reflection} onChange={(e) => update(t.id, { reflection: e.target.value })} placeholder="How is it going?" />
                  </Field>
                  <Field label="Victory">
                    <Textarea rows={2} value={t.victory} onChange={(e) => update(t.id, { victory: e.target.value })} placeholder="Record the wins." />
                  </Field>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button variant="quiet" onClick={() => setTruths((prev) => prev.filter((x) => x.id !== t.id))}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function todayISOTime(): string {
  return new Date().toISOString();
}
