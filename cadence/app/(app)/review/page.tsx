import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { reviewMonthsFor, getReview, monthMetrics } from "@/lib/review";
import { todayInTz, monthOf, fmtMonth, daysInMonth } from "@/lib/time";
import { PageTitle, Card, LinkButton } from "@/components/ui";
import { IconArrowR } from "@/components/icons";

export const metadata = { title: "Monthly Review" };
export const dynamic = "force-dynamic";

export default async function ReviewIndexPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const current = monthOf(today);
  const months = reviewMonthsFor(user.id);
  const dayOfMonth = Number(today.slice(8));
  const nearEnd = dayOfMonth >= daysInMonth(current) - 4;

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <PageTitle
        title="Monthly Review"
        subtitle="Once a month, look yourself in the eye. Rate honestly, reflect properly, then read what the data says."
      />
      {nearEnd && !getReview(user.id, current)?.submitted_at && (
        <Card className="mb-4 border-accent/40 bg-accent-soft/40">
          <p className="text-sm font-medium">
            {fmtMonth(current)} is nearly over — time for your review.
          </p>
        </Card>
      )}
      <div className="space-y-3">
        {months.map((m) => {
          const review = getReview(user.id, m);
          const metrics = monthMetrics(user.id, m);
          const submitted = !!review?.submitted_at;
          return (
            <Card key={m} className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-medium">{fmtMonth(m)}</p>
                <p className="text-xs text-ink-3">
                  {metrics.daysPlanned} days planned · avg score {metrics.avgScore}% ·
                  goals {metrics.goalCompletion}%
                </p>
              </div>
              <span className={`text-xs font-medium ${submitted ? "text-ok" : m === current ? "text-warn" : "text-ink-3"}`}>
                {submitted ? "Reviewed" : m === current ? "In progress" : "Not reviewed"}
              </span>
              <LinkButton href={`/review/${m}`} variant={submitted ? "ghost" : "soft"}>
                {submitted ? "Report" : "Review"} <IconArrowR size={14} />
              </LinkButton>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
