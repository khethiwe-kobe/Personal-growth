"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageTitle, SectionTitle, Select, Stat, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { Person, PersonGroup } from "@/lib/types";
import { daysBetween, formatShort, todayISO, uid } from "@/lib/dates";

const GROUPS: PersonGroup[] = ["Family", "Friends"];

export default function RelationshipsPage() {
  const today = todayISO();
  const [people, setPeople] = useStore<Person[]>("people", []);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<PersonGroup>("Family");

  function add() {
    if (!name.trim()) return;
    setPeople((prev) => [
      { id: uid(), name: name.trim(), group, notes: "", prayingFor: "", createdAt: today },
      ...prev,
    ]);
    setName("");
  }

  function update(id: string, patch: Partial<Person>) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const overdue = people.filter((p) => !p.lastConnected || daysBetween(p.lastConnected, today) > 14);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Relationships"
        subtitle="Love is spelled t-i-m-e. Keep the people God has given you in view, and invest in them on purpose."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="People" value={people.length} />
        <Stat label="Family" value={people.filter((p) => p.group === "Family").length} />
        <Stat label="Worth a call" value={overdue.length} hint="no contact in 14+ days" />
      </div>

      <Card className="mt-6">
        <SectionTitle>Add someone</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="max-w-xs" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Select value={group} onChange={(e) => setGroup(e.target.value as PersonGroup)} className="!w-auto">
            {GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
          <Button onClick={add} disabled={!name.trim()}>
            Add
          </Button>
        </div>
      </Card>

      {GROUPS.map((g) => {
        const inGroup = people.filter((p) => p.group === g);
        if (inGroup.length === 0) return null;
        return (
          <section key={g} className="mt-8">
            <SectionTitle>{g}</SectionTitle>
            <div className="space-y-3">
              {inGroup.map((p) => {
                const days = p.lastConnected ? daysBetween(p.lastConnected, today) : null;
                return (
                  <Card key={p.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <p className="font-display text-lg text-ink">{p.name}</p>
                        {days === null ? (
                          <Tag>never logged</Tag>
                        ) : days > 14 ? (
                          <Tag tone="brown">{days} days ago</Tag>
                        ) : (
                          <Tag tone="sage">connected {days === 0 ? "today" : `${days}d ago`}</Tag>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => update(p.id, { lastConnected: today })}>
                          We connected today
                        </Button>
                        <Button variant="quiet" onClick={() => setPeople((prev) => prev.filter((x) => x.id !== p.id))}>
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="How I am investing">
                        <Textarea rows={2} value={p.notes} onChange={(e) => update(p.id, { notes: e.target.value })} placeholder="Weekly call, monthly coffee, encouragement texts..." />
                      </Field>
                      <Field label="Praying for them">
                        <Textarea rows={2} value={p.prayingFor} onChange={(e) => update(p.id, { prayingFor: e.target.value })} placeholder="What are you asking God for on their behalf?" />
                      </Field>
                    </div>
                    {p.lastConnected && <p className="mt-2 text-xs text-faint">last connected {formatShort(p.lastConnected)}</p>}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {people.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No one added yet." hint="Start with the two or three people you most want to invest in this season." />
        </div>
      )}
    </div>
  );
}
