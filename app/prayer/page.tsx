"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, Modal, PageTitle, SectionTitle, Stat, Tabs, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { PrayerEntry, PrayerKind } from "@/lib/types";
import { formatShort, todayISO, uid } from "@/lib/dates";

const KIND_LABEL: Record<PrayerKind, string> = {
  request: "Prayer requests",
  gratitude: "Gratitude",
  daily: "Daily prayer",
};

export default function PrayerPage() {
  const [prayers, setPrayers] = useStore<PrayerEntry[]>("prayers", []);
  const [tab, setTab] = useState<string>("request");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [answering, setAnswering] = useState<PrayerEntry | null>(null);
  const [answerNote, setAnswerNote] = useState("");

  const kind = tab as PrayerKind;
  const open = prayers.filter((p) => p.kind === kind && !p.answered);
  const answered = prayers.filter((p) => p.answered);

  function add() {
    if (!title.trim()) return;
    setPrayers((prev) => [
      { id: uid(), kind, title: title.trim(), details: details.trim(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setTitle("");
    setDetails("");
  }

  function markAnswered() {
    if (!answering) return;
    setPrayers((prev) =>
      prev.map((p) =>
        p.id === answering.id ? { ...p, answered: true, answeredAt: todayISO(), answerNote: answerNote.trim() } : p
      )
    );
    setAnswering(null);
    setAnswerNote("");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Prayer Journal"
        subtitle="Bring everything to God in prayer — and keep a record, so you never forget what He has done."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open requests" value={prayers.filter((p) => p.kind === "request" && !p.answered).length} />
        <Stat label="Answered" value={answered.length} />
        <Stat label="Gratitude entries" value={prayers.filter((p) => p.kind === "gratitude").length} />
      </div>

      <div className="mt-8">
        <Tabs
          tabs={[
            { id: "request", label: "Requests" },
            { id: "gratitude", label: "Gratitude" },
            { id: "daily", label: "Daily prayer" },
            { id: "answered", label: "Answered" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab !== "answered" && (
        <>
          <Card>
            <SectionTitle>{KIND_LABEL[kind]}</SectionTitle>
            <div className="grid gap-4">
              <Field label={kind === "gratitude" ? "What are you thankful for?" : "Title"}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "request" ? "Healing for..." : kind === "daily" ? "This morning's prayer" : "Thank You, Lord, for..."} />
              </Field>
              <Field label="Details">
                <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Pour out your heart." />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={add} disabled={!title.trim()}>
                Add entry
              </Button>
            </div>
          </Card>

          <section className="mt-6 space-y-2">
            {open.length === 0 ? (
              <EmptyState title={`No ${KIND_LABEL[kind].toLowerCase()} yet.`} />
            ) : (
              open.map((p) => (
                <Card key={p.id} className="p-4 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{p.title}</p>
                      {p.details && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-soft">{p.details}</p>}
                      <p className="mt-1 text-xs text-faint">{formatShort(p.createdAt.slice(0, 10))}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {p.kind === "request" && (
                        <Button variant="ghost" onClick={() => setAnswering(p)}>
                          Mark answered
                        </Button>
                      )}
                      <Button variant="quiet" onClick={() => setPrayers((prev) => prev.filter((x) => x.id !== p.id))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </section>
        </>
      )}

      {tab === "answered" && (
        <section className="space-y-2">
          {answered.length === 0 ? (
            <EmptyState title="No answered prayers recorded yet." hint="When God answers, mark the request — this page becomes your testimony." />
          ) : (
            answered.map((p) => (
              <Card key={p.id} className="border-beige-deep bg-beige/30 p-4 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{p.title}</p>
                  <Tag tone="sage">answered {p.answeredAt && formatShort(p.answeredAt)}</Tag>
                </div>
                {p.details && <p className="mt-1 text-sm text-soft">{p.details}</p>}
                {p.answerNote && (
                  <p className="mt-2 border-l-2 border-brown-faint pl-3 text-sm italic leading-relaxed text-brown-deep">
                    {p.answerNote}
                  </p>
                )}
              </Card>
            ))
          )}
        </section>
      )}

      <Modal open={!!answering} onClose={() => setAnswering(null)} title="An answered prayer">
        <p className="mb-3 text-sm text-soft">{answering?.title}</p>
        <Field label="How did God answer?">
          <Textarea value={answerNote} onChange={(e) => setAnswerNote(e.target.value)} placeholder="Record it, so you can return here on hard days." />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAnswering(null)}>
            Cancel
          </Button>
          <Button onClick={markAnswered}>Mark answered</Button>
        </div>
      </Modal>
    </div>
  );
}
