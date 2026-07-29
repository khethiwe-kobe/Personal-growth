"use client";

// Interactive teaching widgets for the Homecell site. Everything here is
// scoped to the CRC-styled dark theme used by /homecell, so the colours are
// written inline rather than added to the app's global tokens.

import { ReactNode, useMemo, useState } from "react";
import { useStore } from "@/lib/storage";
import type { Input, Passage, Quiz, Scenario } from "@/lib/data/homecell";

/* ---------------------------------------------------------------- shells */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e01a24]">{children}</p>;
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-2xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-4xl">{children}</h2>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-bold uppercase tracking-wide text-white sm:text-xl">{children}</h3>;
}

export function Body({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[15px] leading-relaxed text-white/70 ${className}`}>{children}</p>;
}

export function PullQuote({ children, by }: { children: ReactNode; by: string }) {
  return (
    <blockquote className="border-l-2 border-[#e01a24] pl-4 sm:pl-5">
      <p className="text-lg font-semibold leading-snug text-white sm:text-2xl">&ldquo;{children}&rdquo;</p>
      <cite className="mt-2 block text-xs not-italic uppercase tracking-[0.18em] text-white/45">{by}</cite>
    </blockquote>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "solid" | "outline" | "quiet" };

export function Btn({ tone = "solid", className = "", ...props }: BtnProps) {
  const styles =
    tone === "solid"
      ? "bg-[#e01a24] text-white hover:bg-[#b7141d]"
      : tone === "outline"
        ? "border border-white/20 text-white hover:border-white/50"
        : "text-white/50 hover:text-white";
  return (
    <button
      {...props}
      className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${styles} ${className}`}
    />
  );
}

export function TruthList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-4">
          <span className="mt-1 w-6 shrink-0 text-xs font-bold tabular-nums text-[#e01a24]">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[15px] leading-relaxed text-white/75">{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- scripture */

/** A passage that stays folded until the group has read it aloud together. */
export function ScriptureCard({ passage }: { passage: Passage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span>
          <span className="block text-[11px] uppercase tracking-[0.22em] text-white/40">Read together</span>
          <span className="mt-0.5 block text-lg font-bold text-white">{passage.ref}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#e01a24]">
          {open ? "Hide" : "Open"}
        </span>
      </button>
      {open && (
        <div className="fadein space-y-3 border-t border-white/10 px-5 py-5">
          {passage.verses.map((v) => (
            <p key={v.n} className="text-[15px] leading-relaxed text-white/80">
              <span className="mr-2 align-super text-[11px] font-bold text-[#e01a24]">{v.n}</span>
              {v.text}
            </p>
          ))}
          <p className="pt-1 text-[11px] uppercase tracking-[0.18em] text-white/30">World English Bible</p>
        </div>
      )}
    </div>
  );
}

/** Discussion question whose suggested answer only appears after the group talks. */
export function Discussion({ question, answers }: { question: string; answers: string[] }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <Eyebrow>Discussion</Eyebrow>
      <p className="text-lg font-semibold leading-snug text-white">{question}</p>
      {shown ? (
        <ul className="fadein mt-4 space-y-3 border-t border-white/10 pt-4">
          {answers.map((a, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-white/70">
              <span className="mt-2 h-px w-4 shrink-0 bg-[#e01a24]" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <Btn tone="outline" onClick={() => setShown(true)}>
            Let the group answer first
          </Btn>
        </div>
      )}
    </div>
  );
}

/** Free-text notes, persisted locally so members keep their own answers. */
export function NoteBox({ id, label, placeholder }: { id: string; label: string; placeholder?: string }) {
  const [value, setValue] = useStore<string>(`homecell:note:${id}`, "");
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-white/25 focus:border-[#e01a24] focus:outline-none"
      />
    </label>
  );
}

/* -------------------------------------------------------------- section 1 */

/** Icebreaker: name the area you want changed, then name the seed it costs. */
export function Icebreaker({ areas }: { areas: string[] }) {
  const [area, setArea] = useStore<string>("homecell:icebreaker:area", "");
  const [action, setAction] = useStore<string>("homecell:icebreaker:action", "");
  return (
    <Panel>
      <Eyebrow>Icebreaker</Eyebrow>
      <p className="text-lg font-semibold leading-snug text-white">
        If you could instantly change one area of your life, what would it be?
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => setArea(area === a ? "" : a)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              area === a
                ? "border-[#e01a24] bg-[#e01a24] text-white"
                : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      {area && (
        <div className="fadein mt-6 space-y-4 border-t border-white/10 pt-5">
          <p className="text-[15px] leading-relaxed text-white/70">
            What intentional action will be required to bring about this change?
          </p>
          <textarea
            rows={2}
            value={action}
            placeholder="The one thing I will start doing differently…"
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-white/25 focus:border-[#e01a24] focus:outline-none"
          />
          {action.trim() && (
            <p className="fadein text-sm leading-relaxed text-white/55">
              Everyone wants change, but very few people are willing to sow the seeds that produce it. God&rsquo;s
              Kingdom works on the principle of seedtime and harvest.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Worship set builder — tick the songs the homecell will actually run. */
export function SetList({
  praise,
  worship,
}: {
  praise: { song: string; artist: string }[];
  worship: { song: string; artist: string }[];
}) {
  const [picked, setPicked] = useStore<string[]>("homecell:setlist", []);
  const toggle = (s: string) => setPicked(picked.includes(s) ? picked.filter((p) => p !== s) : [...picked, s]);
  const group = (label: string, songs: { song: string; artist: string }[]) => (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">{label}</p>
      <div className="space-y-2">
        {songs.map((s) => {
          const on = picked.includes(s.song);
          return (
            <button
              key={s.song}
              onClick={() => toggle(s.song)}
              className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                on ? "border-[#e01a24] bg-[#e01a24]/10" : "border-white/10 hover:border-white/30"
              }`}
            >
              <span>
                <span className="block font-semibold text-white">{s.song}</span>
                <span className="mt-0.5 block text-xs uppercase tracking-wide text-white/40">{s.artist}</span>
              </span>
              <span className={`text-xs font-semibold uppercase ${on ? "text-[#e01a24]" : "text-white/25"}`}>
                {on ? "In set" : "Add"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <Panel className="space-y-6">
      {group("Praise", praise)}
      {group("Worship", worship)}
      <p className="text-sm text-white/45">
        Do one or two of each, according to the time available to your Homecell. {picked.length} selected.
      </p>
    </Panel>
  );
}

/* -------------------------------------------------------------- section 2 */

/** Sorting game: is this daily input a seed or a stone? */
export function MindSorter({ inputs }: { inputs: Input[] }) {
  const [answers, setAnswers] = useStore<Record<string, "seed" | "stone">>("homecell:sorter", {});
  const answered = inputs.filter((i) => answers[i.id]);
  const correct = answered.filter((i) => answers[i.id] === i.kind);
  const done = answered.length === inputs.length;

  return (
    <Panel className="space-y-5">
      <div>
        <Eyebrow>Seed or stone</Eyebrow>
        <SubHeading>Sort what you feed your mind</SubHeading>
        <Body className="mt-2">
          Both containers represent our hearts. Decide what each daily input plants: a seed that can produce life, or a
          stone that leaves no room for the Word to grow.
        </Body>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-[#e01a24] transition-[width] duration-500"
          style={{ width: `${(answered.length / inputs.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {inputs.map((i) => {
          const pick = answers[i.id];
          const right = pick === i.kind;
          return (
            <div
              key={i.id}
              className={`rounded-xl border p-4 transition-colors ${
                pick
                  ? right
                    ? "border-[#e01a24]/60 bg-[#e01a24]/[0.07]"
                    : "border-white/25 bg-white/[0.04]"
                  : "border-white/10"
              }`}
            >
              <p className="text-[15px] leading-snug text-white">{i.label}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(["seed", "stone"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setAnswers({ ...answers, [i.id]: k })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                      pick === k
                        ? "border-[#e01a24] bg-[#e01a24] text-white"
                        : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {k}
                  </button>
                ))}
                {pick && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                    {right ? "Correct" : `It is a ${i.kind}`}
                  </span>
                )}
              </div>
              {pick && <p className="fadein mt-3 text-sm leading-relaxed text-white/70">{i.why}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-white/55">
          {correct.length} of {inputs.length} sorted correctly.
          {done && " Which container has the ability to produce life?"}
        </p>
        <Btn tone="quiet" onClick={() => setAnswers({})}>
          Reset
        </Btn>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------- section 3 */

/** Release the seed: nothing multiplies while it stays in your hand. */
export function SeedRelease({ seeds }: { seeds: { id: string; label: string; prompt: string }[] }) {
  const [released, setReleased] = useStore<string[]>("homecell:seeds", []);
  const toggle = (id: string) =>
    setReleased(released.includes(id) ? released.filter((r) => r !== id) : [...released, id]);

  return (
    <Panel className="space-y-5">
      <div>
        <Eyebrow>The seed must leave your hand</Eyebrow>
        <SubHeading>What are you releasing this week?</SubHeading>
        <Body className="mt-2">
          God only multiplies what we release into His hands. Move each seed out of your hand and name what it will cost
          you.
        </Body>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {seeds.map((s) => {
          const on = released.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`rounded-xl border p-4 text-left transition-all duration-300 ${
                on ? "border-[#e01a24] bg-[#e01a24]/10 translate-y-[-2px]" : "border-white/10 hover:border-white/30"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-bold uppercase tracking-wide text-white">{s.label}</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${on ? "text-[#e01a24]" : "text-white/25"}`}
                >
                  {on ? "Released" : "In hand"}
                </span>
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-white/55">{s.prompt}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm leading-relaxed text-white/60">
          {released.length === 0
            ? "Nothing has left your hand yet. A seed held is a seed that cannot multiply."
            : `${released.length} of ${seeds.length} seeds released. God gives seed to the sower and not the hoarder.`}
        </p>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------- section 4 */

/** Attitude scenarios that raise or lower an altitude meter. */
export function AltitudeGame({ scenarios }: { scenarios: Scenario[] }) {
  const [picks, setPicks] = useStore<Record<string, number>>("homecell:altitude", {});
  const score = useMemo(
    () =>
      scenarios.reduce((sum, s) => {
        const idx = picks[s.id];
        return idx === undefined ? sum : sum + s.options[idx].lift;
      }, 0),
    [picks, scenarios],
  );
  const max = scenarios.reduce((sum, s) => sum + Math.max(...s.options.map((o) => o.lift)), 0);
  const min = scenarios.reduce((sum, s) => sum + Math.min(...s.options.map((o) => o.lift)), 0);
  const pct = Math.round(((score - min) / (max - min)) * 100);
  const answered = Object.keys(picks).length;

  return (
    <Panel className="space-y-5">
      <div>
        <Eyebrow>Attitude check</Eyebrow>
        <SubHeading>Choose your response</SubHeading>
        <Body className="mt-2">
          We cannot control everything that happens to us, but we can choose our response. Watch what each response does
          to your altitude.
        </Body>
      </div>

      <div className="flex items-end gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex h-28 w-3 items-end overflow-hidden rounded-full bg-white/10">
          <div
            className="w-full rounded-full bg-[#e01a24] transition-[height] duration-500"
            style={{ height: `${answered ? Math.max(pct, 3) : 0}%` }}
          />
        </div>
        <div>
          <p className="text-3xl font-black tabular-nums text-white">{answered ? `${pct}%` : "—"}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Altitude · {answered} of {scenarios.length} answered
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {scenarios.map((s) => {
          const chosen = picks[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-white/10 p-4">
              <p className="text-[15px] font-semibold leading-snug text-white">{s.setup}</p>
              <div className="mt-3 space-y-2">
                {s.options.map((o, i) => {
                  const on = chosen === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setPicks({ ...picks, [s.id]: i })}
                      className={`block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                        on
                          ? "border-[#e01a24] bg-[#e01a24]/10 text-white"
                          : "border-white/10 text-white/65 hover:border-white/30"
                      }`}
                    >
                      {o.label}
                      {on && <span className="mt-1.5 block text-xs leading-relaxed text-white/50">{o.note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-white/55">Ability opens the door. Attitude decides whether you stay in the room.</p>
        <Btn tone="quiet" onClick={() => setPicks({})}>
          Reset
        </Btn>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- works */

type Oikos = { id: string; name: string; prayed: boolean; invited: boolean };

/** Oikos list — the names each member is sowing prayer and invitations into. */
export function OikosList() {
  const [people, setPeople] = useStore<Oikos[]>("homecell:oikos", []);
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    setPeople([...people, { id: `${Date.now()}`, name, prayed: false, invited: false }]);
    setDraft("");
  };
  const flip = (id: string, key: "prayed" | "invited") =>
    setPeople(people.map((p) => (p.id === id ? { ...p, [key]: !p[key] } : p)));

  return (
    <Panel className="space-y-5">
      <div>
        <Eyebrow>Each one reach one</Eyebrow>
        <SubHeading>Your Oikos list</SubHeading>
        <Body className="mt-2">
          Every invitation, every prayer, and every conversation is a seed God can use to bring someone to salvation.
        </Body>
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a name"
          className="min-w-0 flex-1 rounded-full border border-white/12 bg-black/40 px-5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#e01a24] focus:outline-none"
        />
        <Btn onClick={add} disabled={!draft.trim()}>
          Add
        </Btn>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-white/40">No names yet. Start with the people God has already put around you.</p>
      ) : (
        <div className="space-y-2">
          {people.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-semibold text-white">{p.name}</span>
              {(["prayed", "invited"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => flip(p.id, k)}
                  className={`rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    p[k]
                      ? "border-[#e01a24] bg-[#e01a24] text-white"
                      : "border-white/15 text-white/50 hover:border-white/40"
                  }`}
                >
                  {k === "prayed" ? "Prayed" : "Invited"}
                </button>
              ))}
              <button
                onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
                className="text-xs uppercase tracking-wide text-white/25 hover:text-white/60"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ quiz */

/** Closing recap so the teaching leaves with the group, not just the leader. */
export function Recap({ quiz }: { quiz: Quiz[] }) {
  const [picks, setPicks] = useStore<Record<string, number>>("homecell:quiz", {});
  const answered = quiz.filter((q) => picks[q.id] !== undefined);
  const score = answered.filter((q) => picks[q.id] === q.correct).length;

  return (
    <Panel className="space-y-5">
      <div>
        <Eyebrow>Recap</Eyebrow>
        <SubHeading>Take the teaching home</SubHeading>
        <Body className="mt-2">Run it as a quick round together, or let each member answer on their own phone.</Body>
      </div>

      <div className="space-y-3">
        {quiz.map((q, qi) => {
          const pick = picks[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-white/10 p-4">
              <p className="text-[15px] font-semibold leading-snug text-white">
                <span className="mr-2 text-[#e01a24]">{String(qi + 1).padStart(2, "0")}</span>
                {q.q}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => {
                  const on = pick === i;
                  const reveal = pick !== undefined;
                  const isRight = i === q.correct;
                  return (
                    <button
                      key={i}
                      onClick={() => setPicks({ ...picks, [q.id]: i })}
                      className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                        reveal && isRight
                          ? "border-[#e01a24] bg-[#e01a24]/10 text-white"
                          : on
                            ? "border-white/40 text-white"
                            : "border-white/10 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {pick !== undefined && <p className="fadein mt-3 text-sm leading-relaxed text-white/55">{q.why}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-white/55">
          {answered.length === 0 ? "Not started." : `${score} of ${quiz.length} correct.`}
        </p>
        <Btn tone="quiet" onClick={() => setPicks({})}>
          Reset
        </Btn>
      </div>
    </Panel>
  );
}

/** Simple checklist used for the challenge and prayer points. */
export function CheckList({ id, items }: { id: string; items: string[] }) {
  const [done, setDone] = useStore<string[]>(`homecell:check:${id}`, []);
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const on = done.includes(it);
        return (
          <button
            key={it}
            onClick={() => setDone(on ? done.filter((d) => d !== it) : [...done, it])}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              on ? "border-[#e01a24]/60 bg-[#e01a24]/[0.07]" : "border-white/10 hover:border-white/30"
            }`}
          >
            <span
              className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors ${
                on ? "border-[#e01a24] bg-[#e01a24]" : "border-white/30"
              }`}
            />
            <span className={`text-[15px] leading-relaxed ${on ? "text-white" : "text-white/70"}`}>{it}</span>
          </button>
        );
      })}
    </div>
  );
}
