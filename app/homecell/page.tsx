"use client";

// Interactive Homecell site — the leader's notes turned into something the
// whole group works through together, one step at a time.

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ANNOUNCEMENTS,
  FOCUS_VERSE,
  ICEBREAKER_AREAS,
  MEETING,
  MIND_INPUTS,
  PASSAGES,
  QUIZ,
  SCENARIOS,
  SECTION_1,
  SECTION_2,
  SECTION_3,
  SECTION_4,
  WORKS,
  WORSHIP,
} from "@/lib/data/homecell";
import {
  AltitudeGame,
  Body,
  Btn,
  CheckList,
  Discussion,
  Eyebrow,
  Heading,
  Icebreaker,
  MindSorter,
  NoteBox,
  OikosList,
  Panel,
  PullQuote,
  Recap,
  ScriptureCard,
  SeedRelease,
  SetList,
  SubHeading,
  TruthList,
} from "@/components/homecell";
import { useStore } from "@/lib/storage";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "worship", label: "Worship" },
  { id: "word", label: "The Word" },
  { id: "s1", label: "One" },
  { id: "s2", label: "Two" },
  { id: "s3", label: "Three" },
  { id: "s4", label: "Four" },
  { id: "works", label: "Works" },
  { id: "recap", label: "Recap" },
  { id: "close", label: "Close" },
];

export default function HomecellPage() {
  const [step, setStep] = useStore<number>("homecell:step", 0);
  const top = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);

  // Keep the active step visible in the scrollable rail on narrow screens.
  useEffect(() => {
    const chip = rail.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    chip?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [step]);

  const go = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div ref={top} />

      {/* Masthead */}
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-8 sm:px-8 sm:pb-12 sm:pt-14">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e01a24]">
              {MEETING.kicker}
            </span>
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-white/35 hover:text-white">
              Selah
            </Link>
          </div>
          <h1 className="mt-5 text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl">
            {MEETING.title}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-white/45">
            {MEETING.speaker} &middot; {MEETING.date}
          </p>
        </div>
      </header>

      {/* Step rail */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur">
        <div className="h-0.5 w-full bg-white/10">
          <div className="h-full bg-[#e01a24] transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div ref={rail} className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-5 py-2.5 sm:px-8">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(i)}
              data-active={i === step}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                i === step ? "bg-[#e01a24] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <div key={current.id} className="rise space-y-6">
          {current.id === "welcome" && (
            <>
              <div>
                <Eyebrow>Before the Homecell</Eyebrow>
                <Heading>Welcome</Heading>
                <Body className="mt-3">{MEETING.before}</Body>
              </div>
              <Icebreaker areas={ICEBREAKER_AREAS} />
              <Panel>
                <Eyebrow>Leader transition</Eyebrow>
                <Body>
                  Everyone wants change, but very few people are willing to sow the seeds that produce it. God&rsquo;s
                  Kingdom works on the principle of seedtime and harvest. Learn how this works and you will thrive in
                  God&rsquo;s Kingdom.
                </Body>
              </Panel>
            </>
          )}

          {current.id === "worship" && (
            <>
              <div>
                <Eyebrow>Worship</Eyebrow>
                <Heading>Build the set</Heading>
                <Body className="mt-3">Prepare praise and worship for the Homecell gathering.</Body>
              </div>
              <SetList praise={WORSHIP.praise} worship={WORSHIP.worship} />
            </>
          )}

          {current.id === "word" && (
            <>
              <div>
                <Eyebrow>The Word</Eyebrow>
                <Heading>Sow into your growth</Heading>
                <Body className="mt-3">
                  Be hungry for God, and He will touch and change you. Church, Homecell and DREAMWEEK are all places
                  where we gather to meet with God in His presence. Make the investment in your spirit and value each of
                  these.
                </Body>
              </div>
              <Panel>
                <Eyebrow>Focus Scripture</Eyebrow>
                <p className="text-xl font-semibold leading-snug text-white sm:text-3xl">
                  &ldquo;{FOCUS_VERSE.text}&rdquo;
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/40">
                  {FOCUS_VERSE.ref} &middot; World English Bible
                </p>
              </Panel>
              <Panel>
                <Body>
                  Four sections follow. Work through them at the pace of your group; every section has something for the
                  members to do, not only something to hear.
                </Body>
              </Panel>
            </>
          )}

          {current.id === "s1" && (
            <>
              <div>
                <Eyebrow>Section One</Eyebrow>
                <Heading>{SECTION_1.title}</Heading>
              </div>
              <ScriptureCard passage={PASSAGES.ecc11} />
              <ScriptureCard passage={PASSAGES.prov4} />
              <Panel>
                <Eyebrow>Key truths</Eyebrow>
                <TruthList items={SECTION_1.truths} />
              </Panel>
              <Discussion question={SECTION_1.question} answers={[SECTION_1.answer]} />
              <Panel>
                <NoteBox
                  id="s1"
                  label="One area I have been waiting on instead of working on"
                  placeholder="Write it down before you move on."
                />
              </Panel>
            </>
          )}

          {current.id === "s2" && (
            <>
              <div>
                <Eyebrow>Section Two</Eyebrow>
                <Heading>{SECTION_2.title}</Heading>
              </div>
              <Panel>
                <Eyebrow>Key truths</Eyebrow>
                <TruthList items={SECTION_2.truths} />
              </Panel>
              <Panel className="space-y-4">
                <div>
                  <Eyebrow>Creative illustration</Eyebrow>
                  <SubHeading>Two containers</SubHeading>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">What you&rsquo;ll need</p>
                    <ul className="space-y-1.5 text-sm text-white/70">
                      {SECTION_2.illustration.need.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/10 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">How to run it</p>
                    <ul className="space-y-1.5 text-sm text-white/70">
                      {SECTION_2.illustration.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-lg font-semibold text-white">{SECTION_2.illustration.ask}</p>
                <Body>{SECTION_2.illustration.close}</Body>
              </Panel>
              <MindSorter inputs={MIND_INPUTS} />
              <Panel>
                <PullQuote by={MEETING.speaker}>{SECTION_2.quote}</PullQuote>
              </Panel>
              <Discussion question={SECTION_2.question} answers={SECTION_2.answers} />
            </>
          )}

          {current.id === "s3" && (
            <>
              <div>
                <Eyebrow>Section Three</Eyebrow>
                <Heading>{SECTION_3.title}</Heading>
              </div>
              <ScriptureCard passage={PASSAGES.cor9} />
              <Panel>
                <Eyebrow>Key truths</Eyebrow>
                <TruthList items={SECTION_3.truths} />
              </Panel>
              <SeedRelease seeds={SECTION_3.seeds} />
              <Panel className="space-y-4">
                <div>
                  <Eyebrow>Write down and answer for yourself</Eyebrow>
                  <SubHeading>Between you and God</SubHeading>
                </div>
                {SECTION_3.questions.map((q, i) => (
                  <NoteBox key={q} id={`s3-${i}`} label={q} />
                ))}
              </Panel>
            </>
          )}

          {current.id === "s4" && (
            <>
              <div>
                <Eyebrow>Section Four</Eyebrow>
                <Heading>{SECTION_4.title}</Heading>
              </div>
              <ScriptureCard passage={PASSAGES.gal6} />
              <Panel>
                <Eyebrow>Key truths</Eyebrow>
                <TruthList items={SECTION_4.truths} />
              </Panel>
              <AltitudeGame scenarios={SCENARIOS} />
              <Panel>
                <PullQuote by={MEETING.speaker}>{SECTION_4.quote}</PullQuote>
              </Panel>
              <Discussion question={SECTION_4.question} answers={[SECTION_4.answer]} />
            </>
          )}

          {current.id === "works" && (
            <>
              <div>
                <Eyebrow>Works</Eyebrow>
                <Heading>{WORKS.heading}</Heading>
              </div>
              <Panel>
                <TruthList items={WORKS.points} />
              </Panel>
              <OikosList />
              <Panel className="space-y-3">
                <Eyebrow>Challenge every member this week</Eyebrow>
                <CheckList id="challenge" items={WORKS.challenge} />
              </Panel>
              <Panel className="space-y-3">
                <Eyebrow>Pray in groups of two or three</Eyebrow>
                <Body>{WORKS.prayerNote}</Body>
                <CheckList id="prayer" items={WORKS.prayer} />
              </Panel>
            </>
          )}

          {current.id === "recap" && (
            <>
              <div>
                <Eyebrow>Recap</Eyebrow>
                <Heading>What did we sow tonight?</Heading>
              </div>
              <Recap quiz={QUIZ} />
            </>
          )}

          {current.id === "close" && (
            <>
              <div>
                <Eyebrow>Announcements</Eyebrow>
                <Heading>Before you go</Heading>
              </div>
              <Panel className="space-y-4">
                <Body>{ANNOUNCEMENTS.lead}</Body>
                <a
                  href={ANNOUNCEMENTS.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-full bg-[#e01a24] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#b7141d]"
                >
                  DREAMWEEK tickets
                </a>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ANNOUNCEMENTS.prices.map((p) => (
                    <div key={p.label} className="rounded-xl border border-white/10 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{p.label}</p>
                      <p className="mt-1 text-2xl font-black text-white">{p.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">{ANNOUNCEMENTS.note}</p>
              </Panel>
              <Panel>
                <PullQuote by={`${MEETING.speaker} · ${FOCUS_VERSE.ref}`}>{FOCUS_VERSE.text}</PullQuote>
              </Panel>
            </>
          )}

          {/* Step controls */}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-6">
            <Btn tone="outline" onClick={() => go(step - 1)} disabled={step === 0}>
              Back
            </Btn>
            <span className="text-xs uppercase tracking-[0.18em] text-white/35">
              {step + 1} / {STEPS.length}
            </span>
            <Btn onClick={() => go(step + 1)} disabled={step === STEPS.length - 1}>
              Next
            </Btn>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8">
        <p className="mx-auto max-w-3xl px-5 text-[11px] uppercase tracking-[0.18em] text-white/25 sm:px-8">
          {`${MEETING.kicker} · ${MEETING.date} · Your answers save on this device`}
        </p>
      </footer>
    </div>
  );
}
