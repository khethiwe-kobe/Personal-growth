"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageTitle, SectionTitle, Select, Tabs, Tag, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { LibraryTopic, LibraryUserState, TeachingDoc, TruthCard } from "@/lib/types";
import { LIBRARY_CATEGORIES, allTopics, getTopic, searchLibrary, storiesForTopic, topicsInCategory } from "@/lib/library";
import { situations } from "@/lib/data/situations";
import { bibleStories } from "@/lib/data/stories";
import { THEOLOGY_CATEGORIES, detectCategories, extractRefs, summarize } from "@/lib/refs";
import { extractPdfText } from "@/lib/pdf";
import { formatShort, todayISO, uid } from "@/lib/dates";

const EMPTY_STATE: LibraryUserState = { bookmarks: [], favorites: [], highlights: [], notes: {} };

export default function LibraryPage() {
  const [tab, setTab] = useState("topics");
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Scripture Library"
        subtitle="Find God's word for what you are walking through — so you can answer your feelings with His truth."
      />
      <Tabs
        tabs={[
          { id: "topics", label: "Browse topics" },
          { id: "situations", label: "What are you going through?" },
          { id: "stories", label: "Bible stories" },
          { id: "search", label: "Search" },
          { id: "cards", label: "Truth cards" },
          { id: "teachings", label: "My teachings" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "topics" && <TopicsTab />}
      {tab === "situations" && <SituationsTab onOpenTopic={() => setTab("topics")} />}
      {tab === "stories" && <StoriesTab />}
      {tab === "search" && <SearchTab />}
      {tab === "cards" && <TruthCardsTab />}
      {tab === "teachings" && <TeachingsTab />}
      <p className="mt-12 border-t border-line-soft pt-4 text-xs leading-relaxed text-faint">
        Scripture quotations are from the World English Bible (WEB), a modern-English translation in the public domain.
      </p>
    </div>
  );
}

// ---------- Topics ----------

function TopicsTab() {
  const [category, setCategory] = useState<string>(LIBRARY_CATEGORIES[0]);
  const [topicId, setTopicId] = useState<string | null>(null);
  const topic = topicId ? getTopic(topicId) : null;

  if (topic) return <TopicDetail topic={topic} onBack={() => setTopicId(null)} onOpen={setTopicId} />;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {LIBRARY_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              category === c ? "bg-beige font-medium text-brown-deep" : "text-soft hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topicsInCategory(category).map((t) => (
          <button key={t.id} onClick={() => setTopicId(t.id)} className="text-left">
            <Card className="h-full transition-colors hover:border-brown-faint">
              <p className="font-display text-lg text-ink">{t.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-soft">{t.summary}</p>
              <p className="mt-2 text-xs text-faint">{t.verses.length} key verses</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function TopicDetail({ topic, onBack, onOpen }: { topic: LibraryTopic; onBack: () => void; onOpen: (id: string) => void }) {
  const [state, setState] = useStore<LibraryUserState>("libraryState", EMPTY_STATE);
  const [cards, setCards] = useStore<TruthCard[]>("truthCards", []);
  const stories = storiesForTopic(topic.name);
  const bookmarked = state.bookmarks.includes(topic.id);

  const toggleList = (list: "favorites" | "highlights", ref: string) =>
    setState((s) => ({
      ...s,
      [list]: s[list].includes(ref) ? s[list].filter((r) => r !== ref) : [...s[list], ref],
    }));

  const isPinned = (ref: string) => cards.some((c) => c.ref === ref);
  const togglePin = (ref: string, text: string) =>
    setCards((prev) =>
      isPinned(ref) ? prev.filter((c) => c.ref !== ref) : [...prev, { id: uid(), ref, text, topicId: topic.id, pinnedAt: todayISO() }]
    );

  return (
    <div className="rise">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack}>
          Back to topics
        </Button>
        <Button variant="ghost" onClick={() => setState((s) => ({ ...s, bookmarks: bookmarked ? s.bookmarks.filter((b) => b !== topic.id) : [...s.bookmarks, topic.id] }))}>
          {bookmarked ? "Bookmarked" : "Bookmark topic"}
        </Button>
      </div>
      <h2 className="font-display text-3xl text-ink">{topic.name}</h2>
      <p className="mt-1 text-xs uppercase tracking-widest text-faint">{topic.category}</p>
      <p className="mt-3 max-w-2xl leading-relaxed text-soft">{topic.summary}</p>

      <div className="mt-6 space-y-4">
        {topic.verses.map((v) => {
          const highlighted = state.highlights.includes(v.ref);
          const favorite = state.favorites.includes(v.ref);
          return (
            <Card key={v.ref} className={highlighted ? "border-brown-faint bg-beige/50" : ""}>
              <p className="font-display text-lg leading-relaxed text-ink">&ldquo;{v.text}&rdquo;</p>
              <p className="mt-2 text-sm font-medium text-brown">{v.ref} (WEB)</p>
              <p className="mt-3 text-sm leading-relaxed text-soft">{v.explanation}</p>
              <p className="mt-2 text-sm leading-relaxed text-brown-deep">{v.application}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                <Button variant="quiet" onClick={() => toggleList("favorites", v.ref)}>
                  {favorite ? "Favourited" : "Favourite"}
                </Button>
                <Button variant="quiet" onClick={() => toggleList("highlights", v.ref)}>
                  {highlighted ? "Highlighted" : "Highlight"}
                </Button>
                <Button variant="quiet" onClick={() => togglePin(v.ref, v.text)}>
                  {isPinned(v.ref) ? "Pinned to truth cards" : "Pin as truth card"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Cross references</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {topic.crossRefs.map((r) => (
              <Tag key={r}>{r}</Tag>
            ))}
          </div>
          {topic.related.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">Related topics</p>
              <div className="flex flex-wrap gap-2">
                {topic.related.map((id) => {
                  const t = getTopic(id);
                  return t ? (
                    <button key={id} onClick={() => onOpen(id)} className="rounded-full border border-line px-3 py-1 text-sm text-soft transition-colors hover:border-brown-faint hover:text-ink">
                      {t.name}
                    </button>
                  ) : null;
                })}
              </div>
            </>
          )}
        </Card>
        <Card>
          <SectionTitle>My notes on {topic.name.toLowerCase()}</SectionTitle>
          <Textarea
            rows={5}
            value={state.notes[topic.id] || ""}
            onChange={(e) => setState((s) => ({ ...s, notes: { ...s.notes, [topic.id]: e.target.value } }))}
            placeholder="What is God showing you about this?"
          />
        </Card>
      </div>

      {stories.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Stories that speak to {topic.name.toLowerCase()}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {stories.map((s) => (
              <Card key={s.id}>
                <p className="font-display text-lg text-ink">{s.title}</p>
                <p className="text-xs text-faint">{s.reference}</p>
                <p className="mt-2 text-sm leading-relaxed text-soft">{s.summary}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Situations ----------

function SituationsTab({ onOpenTopic }: { onOpenTopic: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = situations.find((s) => s.id === activeId);

  if (!active) {
    return (
      <div>
        <p className="mb-5 max-w-xl text-sm leading-relaxed text-soft">
          Choose what you are going through today, and let Scripture answer first.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {situations.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className="rounded-2xl border border-line bg-card px-5 py-4 text-left font-display text-lg text-ink transition-colors hover:border-brown-faint hover:bg-beige/40"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const stories = bibleStories.filter((s) => active.storyIds.includes(s.id));
  return (
    <div className="rise">
      <Button variant="quiet" onClick={() => setActiveId(null)}>
        Choose another
      </Button>
      <h2 className="mt-3 font-display text-3xl text-ink">{active.label}</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-soft">{active.encouragement}</p>

      <div className="mt-6 space-y-3">
        {active.scriptures.map((s) => (
          <Card key={s.ref}>
            <p className="font-display text-lg leading-relaxed text-ink">&ldquo;{s.text}&rdquo;</p>
            <p className="mt-2 text-sm font-medium text-brown">{s.ref} (WEB)</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Truths to declare</SectionTitle>
          <ul className="space-y-2">
            {active.truths.map((t, i) => (
              <li key={i} className="border-l-2 border-beige-deep pl-3 font-display text-base leading-relaxed text-ink">
                {t}
              </li>
            ))}
          </ul>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">Reflection</p>
          <ul className="list-inside space-y-1.5">
            {active.reflectionQuestions.map((q, i) => (
              <li key={i} className="text-sm leading-relaxed text-soft">
                {q}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>A prayer for now</SectionTitle>
          <p className="text-sm italic leading-relaxed text-soft">{active.prayer}</p>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">Worship with</p>
          <ul className="space-y-1">
            {active.worship.map((w, i) => (
              <li key={i} className="text-sm text-soft">
                {w}
              </li>
            ))}
          </ul>
          {active.topicIds.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">Go deeper</p>
              <div className="flex flex-wrap gap-2">
                {active.topicIds.map((id) => {
                  const t = getTopic(id);
                  return t ? (
                    <button key={id} onClick={onOpenTopic} className="rounded-full border border-line px-3 py-1 text-sm text-soft hover:border-brown-faint hover:text-ink">
                      {t.name}
                    </button>
                  ) : null;
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {stories.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Bible stories for this season</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {stories.map((s) => (
              <Card key={s.id}>
                <p className="font-display text-lg text-ink">{s.title}</p>
                <p className="text-xs text-faint">{s.reference}</p>
                <p className="mt-2 text-sm leading-relaxed text-soft">{s.summary}</p>
                <p className="mt-2 text-sm leading-relaxed text-brown-deep">{s.application}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Stories ----------

function StoriesTab() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = bibleStories.filter(
    (s) =>
      !q.trim() ||
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.topics.some((t) => t.toLowerCase().includes(q.toLowerCase())) ||
      s.summary.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories by name or topic — fear, waiting, identity..." className="mb-5 max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <Card key={s.id}>
            <button className="w-full text-left" onClick={() => setOpen(open === s.id ? null : s.id)}>
              <p className="font-display text-lg text-ink">{s.title}</p>
              <p className="text-xs text-faint">{s.reference}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.topics.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </button>
            {open === s.id && (
              <div className="fadein mt-3 border-t border-line-soft pt-3">
                <p className="text-sm leading-relaxed text-soft">{s.summary}</p>
                <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wider text-faint">Key lessons</p>
                <ul className="space-y-1">
                  {s.lessons.map((l, i) => (
                    <li key={i} className="border-l-2 border-beige-deep pl-3 text-sm leading-relaxed text-soft">
                      {l}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-faint">{s.keyScriptures.join(" · ")}</p>
                <p className="mt-2 text-sm leading-relaxed text-brown-deep">{s.application}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Search ----------

function SearchTab() {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchLibrary(q), [q]);
  const hasQuery = q.trim().length > 1;
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by topic, reference, keyword, phrase, person, or book — e.g. peace, Romans 8, David" className="mb-6 max-w-xl" />
      {!hasQuery ? (
        <EmptyState title="Type to search the whole library." hint="Topics, verses, stories and people of the Bible." />
      ) : (
        <div className="space-y-8">
          {results.topics.length > 0 && (
            <section>
              <SectionTitle>Topics</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {results.topics.map((t) => (
                  <Tag key={t.id} tone="beige">
                    {t.name} · {t.category}
                  </Tag>
                ))}
              </div>
            </section>
          )}
          {results.verses.length > 0 && (
            <section>
              <SectionTitle>Verses</SectionTitle>
              <div className="space-y-2">
                {results.verses.map((v, i) => (
                  <Card key={i} className="p-4 sm:p-4">
                    <p className="text-sm leading-relaxed text-ink">&ldquo;{v.text}&rdquo;</p>
                    <p className="mt-1 text-xs text-brown">
                      {v.ref} · {v.topic.name}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {results.stories.length > 0 && (
            <section>
              <SectionTitle>Stories</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.stories.map((s) => (
                  <Card key={s.id}>
                    <p className="font-display text-lg text-ink">{s.title}</p>
                    <p className="text-xs text-faint">{s.reference}</p>
                    <p className="mt-2 text-sm text-soft">{s.summary}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {results.topics.length + results.verses.length + results.stories.length === 0 && (
            <EmptyState title="No matches found." hint="Try a broader word — e.g. fear, hope, waiting." />
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Truth cards ----------

function TruthCardsTab() {
  const [cards, setCards] = useStore<TruthCard[]>("truthCards", []);
  return (
    <div>
      <p className="mb-5 max-w-xl text-sm leading-relaxed text-soft">
        Pinned Scriptures appear here and on your dashboard each day. Pin verses from any topic page.
      </p>
      {cards.length === 0 ? (
        <EmptyState title="No truth cards yet." hint="Open a topic and pin the verses that steady you." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Card key={c.id} className="border-beige-deep bg-beige/40">
              <p className="font-display text-lg leading-relaxed text-ink">&ldquo;{c.text}&rdquo;</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-brown">{c.ref}</p>
                <Button variant="quiet" onClick={() => setCards((prev) => prev.filter((x) => x.id !== c.id))}>
                  Unpin
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Teachings (uploaded documents) ----------

function TeachingsTab() {
  const [docs, setDocs] = useStore<TeachingDoc[]>("docs", []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      let text: string;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else {
        text = await file.text();
      }
      ingest(file.name.replace(/\.(pdf|txt|md)$/i, ""), text);
    } catch {
      setError("Could not read that file. You can paste the text below instead.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function ingest(title: string, text: string) {
    const refs = extractRefs(text);
    const cats = detectCategories(text);
    const doc: TeachingDoc = {
      id: uid(),
      title: title || "Untitled teaching",
      category: cats.best,
      uploadedAt: todayISO(),
      summary: summarize(text),
      refs,
      topics: cats.all,
      notes: "",
      excerpt: text.replace(/\s+/g, " ").slice(0, 1500),
    };
    setDocs((prev) => [doc, ...prev]);
    setOpenId(doc.id);
  }

  const open = docs.find((d) => d.id === openId);

  return (
    <div>
      <Card>
        <SectionTitle>Add a teaching document</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-soft">
          Upload PDF teaching notes — like your Baptism of Suffering document — and the library will extract every
          Scripture reference, detect the theology topics, and file it into a searchable collection.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Reading document..." : "Upload PDF or text file"}
          </Button>
          {error && <p className="text-sm text-brown-deep">{error}</p>}
        </div>
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Or paste the text</p>
          <div className="grid gap-3">
            <Input value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} placeholder="Teaching title, e.g. Baptism of Suffering" />
            <Textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the teaching notes here..." />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                disabled={!pasted.trim()}
                onClick={() => {
                  ingest(pastedTitle.trim() || "Pasted teaching", pasted);
                  setPasted("");
                  setPastedTitle("");
                }}
              >
                Extract and file
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {open && (
        <Card className="mt-6 rise">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl text-ink">{open.title}</h3>
              <p className="mt-1 text-xs text-faint">added {formatShort(open.uploadedAt)}</p>
            </div>
            <Select
              value={open.category}
              onChange={(e) => setDocs((prev) => prev.map((d) => (d.id === open.id ? { ...d, category: e.target.value } : d)))}
              className="!w-auto"
            >
              {THEOLOGY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          {open.summary && <p className="mt-3 text-sm leading-relaxed text-soft">{open.summary}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {open.topics.map((t) => (
              <Tag key={t} tone="brown">
                {t}
              </Tag>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">
            Extracted Scripture references ({open.refs.length})
          </p>
          {open.refs.length === 0 ? (
            <p className="text-sm text-faint">No references detected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {open.refs.map((r) => (
                <Tag key={r}>{r}</Tag>
              ))}
            </div>
          )}
          <div className="mt-5">
            <Field label="Study notes">
              <Textarea
                rows={4}
                value={open.notes}
                onChange={(e) => setDocs((prev) => prev.map((d) => (d.id === open.id ? { ...d, notes: e.target.value } : d)))}
                placeholder="Key teachings, cross references, what to revisit..."
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-between">
            <Button variant="quiet" onClick={() => setOpenId(null)}>
              Close
            </Button>
            <Button variant="quiet" onClick={() => { setDocs((prev) => prev.filter((d) => d.id !== open.id)); setOpenId(null); }}>
              Delete document
            </Button>
          </div>
        </Card>
      )}

      <section className="mt-8">
        <SectionTitle>My collections</SectionTitle>
        {docs.length === 0 ? (
          <EmptyState title="No teachings uploaded yet." hint="Your uploaded documents become searchable Scripture collections." />
        ) : (
          <div className="space-y-2">
            {THEOLOGY_CATEGORIES.filter((c) => docs.some((d) => d.category === c)).map((c) => (
              <div key={c}>
                <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-widest text-faint">{c}</p>
                {docs
                  .filter((d) => d.category === c)
                  .map((d) => (
                    <button key={d.id} className="mb-2 block w-full text-left" onClick={() => setOpenId(d.id)}>
                      <Card className="p-4 transition-colors hover:border-brown-faint sm:p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-display text-lg text-ink">{d.title}</p>
                          <span className="shrink-0 text-xs text-faint">{d.refs.length} refs</span>
                        </div>
                        {d.summary && <p className="mt-1 line-clamp-2 text-sm text-soft">{d.summary}</p>}
                      </Card>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
