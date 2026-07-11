"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageTitle, ProgressBar, SectionTitle, Tag } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { Affirmation, Goal, VisionItem } from "@/lib/types";
import { dayOfYear, todayISO, uid } from "@/lib/dates";
import { deleteImage, getImage, putImage } from "@/lib/idb";
import { affirmations as defaultAffirmations } from "@/lib/data/quotes";
import { allTopics } from "@/lib/library";

const SECTIONS = ["Faith", "Career", "Health", "Relationships", "Finances", "Personal Growth"];

export default function VisionPage() {
  const today = todayISO();
  const [items, setItems] = useStore<VisionItem[]>("vision", []);
  const [affirmations, setAffirmations] = useStore<Affirmation[]>("affirmations", []);
  const [goals] = useStore<Goal[]>("goals", []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [section, setSection] = useState(SECTIONS[0]);
  const [caption, setCaption] = useState("");
  const [newAffirmation, setNewAffirmation] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const it of items) {
        const blob = await getImage(it.id);
        if (blob) out[it.id] = URL.createObjectURL(blob);
      }
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  async function upload(file: File) {
    const id = uid();
    await putImage(id, file);
    setItems((prev) => [
      ...prev,
      { id, section, caption: caption.trim(), order: prev.length, createdAt: today },
    ]);
    setCaption("");
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const list = [...prev].sort((a, b) => a.order - b.order);
      const from = list.findIndex((i) => i.id === dragId);
      const to = list.findIndex((i) => i.id === targetId);
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list.map((i, idx) => ({ ...i, order: idx }));
    });
    setDragId(null);
  }

  const dailyAffirmation =
    affirmations.length > 0
      ? affirmations[dayOfYear(today) % affirmations.length].text
      : defaultAffirmations[dayOfYear(today) % defaultAffirmations.length];

  // A daily scripture drawn from the library
  const verseOfDay = useMemo(() => {
    const withVerses = allTopics.filter((t) => t.verses.length > 0);
    const t = withVerses[dayOfYear(today) % withVerses.length];
    return t.verses[0];
  }, [today]);

  // Progress toward each vision section, from goals in matching categories
  const sectionProgress = (s: string) => {
    const related = goals.filter((g) => g.category === s);
    if (!related.length) return null;
    const pct = related.reduce(
      (sum, g) => sum + (g.status === "completed" ? 100 : g.milestones.length ? (g.milestones.filter((m) => m.done).length / g.milestones.length) * 100 : 0),
      0
    );
    return Math.round(pct / related.length);
  };

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Vision Board" subtitle="Keep what you are believing for in front of your eyes — and anchor it in truth." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="border-beige-deep bg-beige/40">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Today&apos;s affirmation</p>
          <p className="mt-2 font-display text-lg leading-relaxed text-ink">{dailyAffirmation}</p>
        </Card>
        <Card className="border-beige-deep bg-beige/40">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Scripture for the vision</p>
          <p className="mt-2 font-display text-lg leading-relaxed text-ink">&ldquo;{verseOfDay.text}&rdquo;</p>
          <p className="mt-1 text-sm text-brown">{verseOfDay.ref}</p>
        </Card>
      </div>

      <Card className="mb-8">
        <SectionTitle>Add to the board</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Field label="Section">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus:border-brown-soft focus:outline-none"
            >
              {SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Caption">
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does this picture represent?" />
          </Field>
          <div className="flex items-end">
            <label className="cursor-pointer rounded-full bg-brown px-4 py-2 text-sm text-white transition-colors hover:bg-brown-deep">
              Upload image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        </div>
        <p className="mt-2 text-xs text-faint">Drag images to rearrange them. Images are stored privately on this device.</p>
      </Card>

      {SECTIONS.map((s) => {
        const inSection = sorted.filter((i) => i.section === s);
        const progress = sectionProgress(s);
        if (inSection.length === 0 && progress === null) return null;
        return (
          <section key={s} className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-4">
              <SectionTitle>{s}</SectionTitle>
              {progress !== null && (
                <div className="flex w-40 items-center gap-2">
                  <ProgressBar value={progress} />
                  <span className="shrink-0 text-xs text-soft">{progress}%</span>
                </div>
              )}
            </div>
            {inSection.length === 0 ? (
              <p className="text-sm text-faint">No images yet for this area.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {inSection.map((it) => (
                  <figure
                    key={it.id}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => drop(it.id)}
                    className={`cursor-grab overflow-hidden rounded-2xl border bg-card transition-shadow active:cursor-grabbing ${
                      dragId === it.id ? "border-brown-faint opacity-60" : "border-line"
                    }`}
                  >
                    {urls[it.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls[it.id]} alt={it.caption || s} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full bg-beige" />
                    )}
                    <figcaption className="flex items-start justify-between gap-2 px-3 py-2">
                      <span className="text-xs leading-relaxed text-soft">{it.caption || "—"}</span>
                      <button
                        className="shrink-0 text-xs text-faint hover:text-ink"
                        onClick={async () => {
                          await deleteImage(it.id);
                          setItems((prev) => prev.filter((x) => x.id !== it.id));
                        }}
                      >
                        Remove
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {items.length === 0 && <EmptyState title="Your board is empty." hint="Upload the first picture of where you are going." />}

      <Card className="mt-4">
        <SectionTitle>My affirmations</SectionTitle>
        <p className="mb-3 text-sm text-soft">Rooted in Scripture, spoken in faith. One appears on the board each day.</p>
        <div className="flex gap-2">
          <Input
            value={newAffirmation}
            onChange={(e) => setNewAffirmation(e.target.value)}
            placeholder="I am a new creation in Christ. (2 Corinthians 5:17)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newAffirmation.trim()) {
                setAffirmations((prev) => [...prev, { id: uid(), text: newAffirmation.trim() }]);
                setNewAffirmation("");
              }
            }}
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (!newAffirmation.trim()) return;
              setAffirmations((prev) => [...prev, { id: uid(), text: newAffirmation.trim() }]);
              setNewAffirmation("");
            }}
          >
            Add
          </Button>
        </div>
        {affirmations.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {affirmations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm text-soft">
                {a.text}
                <Button variant="quiet" onClick={() => setAffirmations((prev) => prev.filter((x) => x.id !== a.id))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
