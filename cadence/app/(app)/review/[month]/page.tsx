import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  REVIEW_SECTIONS, REFLECTIONS, YES_NO, getReview, monthMetrics, monthInsights,
} from "@/lib/review";
import { fmtMonth, addMonths, fmtMinutes, fmtDateShort, monthOf, todayInTz } from "@/lib/time";
import { PageTitle, Card, SectionHeading, Ring, Stat, ProgressBar } from "@/components/ui";
import { CategoryBars } from "@/components/charts";
import ReviewForm from "@/components/ReviewForm";
import { IconLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ReviewMonthPage({
  params,
}: { params: Promise<{ month: string }> }) {
  const user = await requireUser();
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const today = todayInTz(user.timezone);
  if (month > monthOf(today)) notFound();

  const review = await getReview(user.id, month);
  const submitted = !!review?.submitted_at;
  let answers: Record<string, unknown> = {};
  try { answers = JSON.parse(review?.answers_json ?? "{}"); } catch {}
  const sections = REVIEW_SECTIONS(user.role);

  if (!submitted) {
    return (
      <div className="fade-up mx-auto max-w-2xl">
        <PageTitle
          title={`${fmtMonth(month)} review`}
          subtitle="0 = didn't happen, 10 = exactly who you want to be. Honesty is the whole point."
        />
        <ReviewForm
          month={month} sections={sections}
          reflections={REFLECTIONS} yesNo={YES_NO}
          initial={answers}
        />
      </div>
    );
  }

  // ---------- report ----------
  const [metrics, prev] = await Promise.all([
    monthMetrics(user.id, month),
    monthMetrics(user.id, addMonths(month, -1)),
  ]);
  const insights = monthInsights(metrics, prev);
  const ratings = (answers.ratings ?? {}) as Record<string, number>;
  const yesno = (answers.yesno ?? {}) as Record<string, boolean>;

  const sectionScores = sections.map((s) => {
    const vals = s.prompts.map((_, i) => ratings[`${s.key}.${i}`] ?? 0).filter((v) => v > 0);
    return {
      key: s.key, title: s.title,
      score: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) : 0,
    };
  });
  const rated = sectionScores.filter((s) => s.score > 0);
  const selfScore = rated.length
    ? Math.round(rated.reduce((a, b) => a + b.score, 0) / rated.length)
    : 0;
  // Overall = half what you felt, half what the data measured. Both are shown.
  const overall = metrics.avgScore > 0 && selfScore > 0
    ? Math.round((selfScore + metrics.avgScore) / 2)
    : Math.max(selfScore, metrics.avgScore);

  const SECTION_COLORS = ["#b7c4d6", "#c4c4bc", "#cbb9d9", "#d9b8c4", "#d9c9a8", "#a8c5b4"];

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <PageTitle
        title={`${fmtMonth(month)} report`}
        subtitle={`Submitted ${review?.submitted_at?.slice(0, 10)} · overall = ½ self-assessment (${selfScore}%) + ½ measured productivity (${metrics.avgScore}%)`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-center">
          <Ring pct={overall} size={116} sub="overall month" />
        </Card>
        <Card className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="Avg daily score" value={`${metrics.avgScore}%`} />
            <Stat label="Task completion" value={`${metrics.avgCompletion}%`} />
            <Stat label="Goal completion" value={`${metrics.goalCompletion}%`} />
            <Stat label="Focus hours" value={fmtMinutes(metrics.focusMinutes)} />
            <Stat label="Planned vs done" value={`${fmtMinutes(metrics.completedMinutes)} / ${fmtMinutes(metrics.plannedMinutes)}`} />
            <Stat label="Days planned" value={metrics.daysPlanned} />
          </div>
        </Card>
      </div>

      <SectionHeading>Compared with {fmtMonth(addMonths(month, -1)).split(" ")[0]}</SectionHeading>
      <Card>
        <ul className="space-y-1.5">
          {insights.map((i) => (
            <li key={i} className="text-sm text-ink-2">
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />{i}
            </li>
          ))}
        </ul>
      </Card>

      <SectionHeading>Category scores (self-assessed)</SectionHeading>
      <Card>
        <CategoryBars
          rows={sectionScores.map((s, i) => ({
            label: s.title, value: s.score, color: SECTION_COLORS[i % SECTION_COLORS.length],
          }))}
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </Card>

      <SectionHeading>Best & hardest days</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="mb-2 text-xs font-medium text-ink-3">Best days</p>
          {metrics.bestDays.length === 0 ? <p className="text-sm text-ink-3">No planned days.</p> : (
            <ul className="space-y-1.5">
              {metrics.bestDays.map((d) => (
                <li key={d.date} className="flex justify-between text-sm">
                  <span>{fmtDateShort(d.date)}</span>
                  <span className="font-medium tabular-nums text-ok">{d.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <p className="mb-2 text-xs font-medium text-ink-3">Hardest days</p>
          {metrics.worstDays.length === 0 ? <p className="text-sm text-ink-3">No planned days.</p> : (
            <ul className="space-y-1.5">
              {metrics.worstDays.map((d) => (
                <li key={d.date} className="flex justify-between text-sm">
                  <span>{fmtDateShort(d.date)}</span>
                  <span className="font-medium tabular-nums text-danger">{d.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SectionHeading>
        <span className="inline-flex items-center gap-1.5"><IconLock size={13} /> Your reflections (private)</span>
      </SectionHeading>
      <Card className="space-y-3">
        {REFLECTIONS.map((r) => {
          const v = answers[r.key] as string | undefined;
          if (!v) return null;
          return (
            <div key={r.key}>
              <p className="text-xs font-medium text-ink-3">{r.q}</p>
              <p className="mt-0.5 text-sm">{v}</p>
            </div>
          );
        })}
        {YES_NO.some((q) => yesno[q.key] !== undefined) && (
          <div className="border-t border-line pt-3">
            {YES_NO.map((q) => yesno[q.key] !== undefined && (
              <p key={q.key} className="text-sm">
                <span className="text-ink-3">{q.q}</span>{" "}
                <span className={`font-medium ${yesno[q.key] ? "text-ok" : "text-danger"}`}>
                  {yesno[q.key] ? "Yes" : "No"}
                </span>
              </p>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-6 text-xs">
        <Link href="/review" className="font-medium text-accent-ink hover:underline">← All months</Link>
      </p>
    </div>
  );
}
