"use client";

import { ReactNode, useState } from "react";
import { Button, Card, Check, Input, PageTitle, SectionTitle, Stat, Tabs, Tag } from "@/components/ui";
import { BarChart } from "@/components/viz";
import { useStore } from "@/lib/storage";
import { BizModel, DEFAULT_MODEL, LineResult, mealBreakEven, rand, summarise } from "@/lib/business";

/** A labelled number input bound to one field of the model. */
function Num({
  label,
  field,
  model,
  set,
  prefix,
  suffix,
  step = 1,
  hint,
}: {
  label: string;
  field: keyof BizModel;
  model: BizModel;
  set: (field: keyof BizModel, value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}) {
  const value = model[field];
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-faint">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">{prefix}</span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={typeof value === "number" ? value : 0}
          onChange={(e) => set(field, e.target.value === "" ? 0 : Number(e.target.value))}
          className={prefix ? "pl-7" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

/** Revenue → costs → profit, with the rand-per-hour verdict. */
function LineCard({ line, weeksPerMonth }: { line: LineResult; weeksPerMonth: number }) {
  const rate = line.perHour;
  const free = rate === null;
  const verdict = rate === null || rate >= 500 ? "sage" : rate >= 300 ? "beige" : "brown";
  const share = line.revenue > 0 ? Math.round((line.net / line.revenue) * 100) : 0;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink">{line.name}</p>
          <p className="mt-0.5 truncate text-xs text-soft">{line.note}</p>
        </div>
        <Tag tone={verdict}>{rate === null ? "No hours" : `${rand(rate)}/hr`}</Tag>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-soft">Revenue</dt>
          <dd className="text-ink">{rand(line.revenue)}</dd>
        </div>
        {line.variable > 0 && (
          <div className="flex justify-between">
            <dt className="text-soft">{line.variableLabel}</dt>
            <dd className="text-faint">−{rand(line.variable)}</dd>
          </div>
        )}
        {line.fixed > 0 && (
          <div className="flex justify-between">
            <dt className="text-soft">Fixed costs</dt>
            <dd className="text-faint">−{rand(line.fixed)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1 font-medium">
          <dt className="text-ink">Profit</dt>
          <dd className="text-ink">{rand(line.net)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-faint">
        {free ? "None of your time" : `${line.hours} hrs a week · ${Math.round(line.hours * weeksPerMonth)} a month`} ·{" "}
        {share}% margin
      </p>
    </div>
  );
}

export default function BusinessPage() {
  const [model, setModel] = useStore<BizModel>("business-model", DEFAULT_MODEL);
  const [tab, setTab] = useState("summary");

  // Merge so a model saved before a field existed still loads cleanly.
  const m: BizModel = { ...DEFAULT_MODEL, ...model };
  const s = summarise(m);
  const breakEven = mealBreakEven(m);

  const set = (field: keyof BizModel, value: number | boolean) =>
    setModel((prev) => ({ ...DEFAULT_MODEL, ...prev, [field]: value }));
  const setNum = (field: keyof BizModel, value: number) => set(field, value);

  const hoursTone = s.hours > 20 ? "text-[#c06a4a]" : "text-soft";

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Side Business"
        subtitle="Model the service business before you commit a single Sunday to it. Change any assumption and watch the one number that matters move: rand earned per hour of your time. Everything saves automatically."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue / month" value={rand(s.revenue)} hint={`${s.active.length} active lines`} />
        <Stat label="Profit / month" value={rand(s.net)} hint={`${rand(s.winterNet)} in winter`} />
        <Stat label="Your hours / week" value={s.hours} hint={s.hours > 20 ? "Above the 16-hour cap" : "Within the cap"} />
        <Stat label="Rand per hour" value={rand(s.perHour)} hint={s.perHour >= 400 ? "Worth your Sunday" : "Below the R400 floor"} />
      </div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { id: "summary", label: "Summary" },
            { id: "meals", label: "Meal prep" },
            { id: "swim", label: "Swimming" },
            { id: "sorted", label: "Retainer" },
            { id: "digital", label: "Digital" },
            { id: "goal", label: "Target & payback" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "summary" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {s.lines.map((l) => (l.active ? <LineCard key={l.id} line={l} weeksPerMonth={m.weeksPerMonth} /> : null))}
          </div>

          {s.active.length > 0 && (
            <Card>
              <SectionTitle>Rand per hour, by line</SectionTitle>
              <p className="mb-4 text-sm text-soft">
                The tallest bar is where your next hour should go. Anything under R400 has to justify itself or be cut.
              </p>
              <BarChart
                data={s.active
                  .filter((l) => l.perHour !== null)
                  .map((l) => ({ label: l.name.split(" ")[0], value: l.perHour!, hint: `${l.hours}h/wk` }))}
                unit=""
              />
            </Card>
          )}

          <Card>
            <SectionTitle>Profit, by line</SectionTitle>
            <BarChart
              data={s.active.map((l) => ({ label: l.name.split(" ")[0], value: l.net, hint: rand(l.net) }))}
              unit=""
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-beige/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-faint">Summer</p>
                <p className="mt-1 font-display text-2xl text-ink">{rand(s.net)}</p>
                <p className="mt-0.5 text-xs text-soft">{s.hours} hrs a week, everything running</p>
              </div>
              <div className="rounded-xl bg-beige/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-faint">Winter (no pool)</p>
                <p className="mt-1 font-display text-2xl text-ink">{rand(s.winterNet)}</p>
                <p className="mt-0.5 text-xs text-soft">{s.winterHours} hrs a week — push meal prep here</p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Working assumptions</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <Num
                label="Delivery weeks a month"
                field="weeksPerMonth"
                model={m}
                set={setNum}
                step={0.33}
                hint="4 = a week off each quarter"
              />
              <Num label="Ingredient cost a meal" field="mpCogs" model={m} set={setNum} prefix="R" hint="Protein, starch, veg, container" />
              <Num label="Startup capital" field="startupCost" model={m} set={setNum} prefix="R" hint="Everything before your first sale" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setModel(() => DEFAULT_MODEL)}>
                Reset to the plan
              </Button>
              <span className="text-xs text-faint">
                Defaults come from <code className="text-soft">docs/service-business-plan.md</code>.
              </span>
            </div>
          </Card>
        </div>
      )}

      {tab === "meals" && (
        <div className="space-y-6">
          <Card>
            <SectionTitle action={<Tag>{rand(s.lines[0].perHour ?? 0)}/hr</Tag>}>Sunday Kitchen</SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-soft">
              One menu a week for everyone, three swap slots, collection not delivery. Break-even is{" "}
              <strong className="text-ink">{breakEven} client{breakEven === 1 ? "" : "s"}</strong> — below that the fixed
              costs eat you.
            </p>
            <Grid>
              <Num label="Core clients" field="mpCore" model={m} set={setNum} />
              <Num label="Premium clients" field="mpPremium" model={m} set={setNum} hint="With consultation" />
              <Num label="Meals a client, a week" field="mpMealsPerClient" model={m} set={setNum} />
              <Num label="Core price a meal" field="mpCorePrice" model={m} set={setNum} prefix="R" />
              <Num label="Premium price a meal" field="mpPremiumPrice" model={m} set={setNum} prefix="R" hint="Market tops out ~R210" />
              <Num label="Ingredient cost a meal" field="mpCogs" model={m} set={setNum} prefix="R" />
              <Num label="Consults a month" field="mpConsults" model={m} set={setNum} />
              <Num label="Consult fee" field="mpConsultPrice" model={m} set={setNum} prefix="R" />
              <Num label="Fixed costs a month" field="mpFixed" model={m} set={setNum} prefix="R" hint="Gas, marketing, insurance" />
              <Num label="Helper a month" field="mpHelper" model={m} set={setNum} prefix="R" hint="Hire past 80 meals" />
              <Num label="Your hours a week" field="mpHours" model={m} set={setNum} hint="Shop, cook, portion, hand over" />
            </Grid>
          </Card>

          <Card>
            <SectionTitle
              action={
                <Check checked={m.corpOn} onChange={(v) => set("corpOn", v)} label={m.corpOn ? "On" : "Off"} />
              }
            >
              Corporate lunchbox drop
            </SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-soft">
              The highest-leverage line in the whole business: many meals, one delivery stop, one invoice. Two office
              managers a week is the entire sales effort.
            </p>
            <Grid>
              <Num label="People in the office" field="corpHeads" model={m} set={setNum} />
              <Num label="Drops a week" field="corpDrops" model={m} set={setNum} />
              <Num label="Price a meal" field="corpPrice" model={m} set={setNum} prefix="R" />
              <Num label="Extra hours a week" field="corpHours" model={m} set={setNum} />
            </Grid>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <LineCard line={s.lines[0]} weeksPerMonth={m.weeksPerMonth} />
            {m.corpOn && <LineCard line={s.lines[1]} weeksPerMonth={m.weeksPerMonth} />}
          </div>
        </div>
      )}

      {tab === "swim" && (
        <div className="space-y-6">
          <Card>
            <SectionTitle
              action={<Check checked={m.swOn} onChange={(v) => set("swOn", v)} label={m.swOn ? "In season" : "Off season"} />}
            >
              Friday Water
            </SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-soft">
              Prepaid blocks to small groups, never pay-as-you-go privates. A slot is one hour of pool time whatever the
              lesson length — that is what you are charged for. Pool hire is the assumption to go and verify first: the
              model breaks around R550 an hour.
            </p>
            <Grid>
              <Num label="Adult slots a week" field="swAdultSlots" model={m} set={setNum} />
              <Num label="Adults a slot" field="swAdultSize" model={m} set={setNum} hint="Hard cap of 4" />
              <Num label="Adult block price" field="swAdultBlock" model={m} set={setNum} prefix="R" hint="Per person, prepaid" />
              <Num label="Kids slots a week" field="swKidSlots" model={m} set={setNum} />
              <Num label="Kids a slot" field="swKidSize" model={m} set={setNum} />
              <Num label="Kids block price" field="swKidBlock" model={m} set={setNum} prefix="R" />
              <Num label="Weeks in a block" field="swBlockWeeks" model={m} set={setNum} />
              <Num label="Places filled" field="swFill" model={m} set={setNum} suffix="%" hint="Be honest for cycle one" />
              <Num label="Pool hire an hour" field="swPoolRate" model={m} set={setNum} prefix="R" hint="Get three quotes" />
              <Num label="Fixed costs a month" field="swFixed" model={m} set={setNum} prefix="R" hint="Liability cover, marketing" />
              <Num label="Admin hours a week" field="swAdminHours" model={m} set={setNum} />
            </Grid>
          </Card>
          {m.swOn && <LineCard line={s.lines[2]} weeksPerMonth={m.weeksPerMonth} />}
        </div>
      )}

      {tab === "sorted" && (
        <div className="space-y-6">
          <Card>
            <SectionTitle action={<Tag tone="sage">{rand(s.lines[3].perHour ?? 0)}/hr</Tag>}>Sorted</SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-soft">
              Licence discs, Home Affairs bookings, medical aid claims, insurance quotes. No stock, no premises, done
              from your phone. Client pays every third-party fee upfront — you never float their money.
            </p>
            <Grid>
              <Num label="Lite clients" field="soLite" model={m} set={setNum} hint="3 tasks a month" />
              <Num label="Lite price" field="soLitePrice" model={m} set={setNum} prefix="R" />
              <Num label="Plus clients" field="soPlus" model={m} set={setNum} hint="8 tasks + WhatsApp" />
              <Num label="Plus price" field="soPlusPrice" model={m} set={setNum} prefix="R" />
              <Num label="Power hours a month" field="soPower" model={m} set={setNum} />
              <Num label="Power hour price" field="soPowerPrice" model={m} set={setNum} prefix="R" />
              <Num label="Costs a month" field="soFixed" model={m} set={setNum} prefix="R" hint="Data, tools, fees" />
              <Num label="Your hours a month" field="soHours" model={m} set={setNum} />
            </Grid>
          </Card>
          <LineCard line={s.lines[3]} weeksPerMonth={m.weeksPerMonth} />
        </div>
      )}

      {tab === "digital" && (
        <div className="space-y-6">
          <Card>
            <SectionTitle>Built once, sold forever</SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-soft">
              The only line with no hours attached — which makes it the only one that grows without costing you a
              weekend. You already ship software; most of your competition cannot.
            </p>
            <Grid>
              <Num label="Meal plan PDFs a month" field="dgPdf" model={m} set={setNum} />
              <Num label="PDF price" field="dgPdfPrice" model={m} set={setNum} prefix="R" />
              <Num label="Video courses a month" field="dgCourse" model={m} set={setNum} />
              <Num label="Course price" field="dgCoursePrice" model={m} set={setNum} prefix="R" />
              <Num label="Payment fees" field="dgFeePct" model={m} set={setNum} suffix="%" />
            </Grid>
          </Card>
          <LineCard line={s.lines[4]} weeksPerMonth={m.weeksPerMonth} />
        </div>
      )}

      {tab === "goal" && (
        <div className="space-y-6">
          <Card>
            <SectionTitle>What are you actually aiming at?</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="Target profit a month" field="targetIncome" model={m} set={setNum} prefix="R" />
              <Num label="Startup capital" field="startupCost" model={m} set={setNum} prefix="R" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Gap to target"
                value={s.gap === 0 ? "Cleared" : rand(s.gap)}
                hint={s.gap === 0 ? "Raise the target" : `${s.clientsToTarget} more meal clients`}
              />
              <Stat
                label="Capital paid back"
                value={s.payback > 0 ? `${s.payback} mo` : "—"}
                hint={s.payback > 0 && s.payback <= 4 ? "Comfortable" : "Slow — trim the startup list"}
              />
              <Stat label="Blended rate" value={`${rand(s.perHour)}/hr`} hint="Your real hourly wage" />
            </div>
          </Card>

          <Card>
            <SectionTitle>The rules that protect your time</SectionTitle>
            <ol className="space-y-2 text-sm leading-relaxed text-soft">
              <li><strong className="text-ink">1.</strong> One menu a week. Three swap slots. No bespoke menus below Premium.</li>
              <li><strong className="text-ink">2.</strong> Prepaid blocks and subscriptions only. No pay-as-you-go.</li>
              <li><strong className="text-ink">3.</strong> Collection first. Delivery is a paid extra someone else drives.</li>
              <li><strong className="text-ink">4.</strong> Twelve kilometre radius. Hard stop.</li>
              <li><strong className="text-ink">5.</strong> Two lines active at once, maximum, until one is on autopilot.</li>
              <li><strong className="text-ink">6.</strong> Admin in one 90-minute block on Wednesday. Not all week.</li>
              <li><strong className="text-ink">7.</strong> Book capacity, not clients. A waiting list is how you justify the next price rise.</li>
              <li><strong className="text-ink">8.</strong> Nothing new gets added unless it beats R400 an hour.</li>
            </ol>
            <p className={`mt-4 border-t border-line pt-4 text-sm ${hoursTone}`}>
              This model has you working <strong>{s.hours} hours a week</strong> on top of your job.
              {s.hours > 20 ? " That will not survive contact with a bad month — cut a line or hire help." : " That is sustainable."}
            </p>
          </Card>

          <Card>
            <SectionTitle>Before your first paying client</SectionTitle>
            <ul className="space-y-2 text-sm leading-relaxed text-soft">
              <li>— Certificate of Acceptability from your municipal health inspector. Longest lead time; start now.</li>
              <li>— Food handler hygiene training, and a signed allergy declaration from every meal client.</li>
              <li>— Swim instructor qualification, valid first aid, and public liability cover before anyone enters the water.</li>
              <li>— Three real pool-hire quotes. The swim numbers above rest on a guess until you have them.</li>
              <li>— No filing anyone&apos;s tax return for a fee: gathering their documents is fine, submitting is not.</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
