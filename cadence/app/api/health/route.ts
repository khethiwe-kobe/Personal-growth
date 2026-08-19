import { all, get } from "@/lib/db";
import { getSessionUser, getGroupForUser } from "@/lib/auth";
import {
  daySummaryFor, sharedToday, countdownEvents, upcomingEvents,
  summariesForRange, allGoalStats,
} from "@/lib/repo";
import { todayInTz, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Self-diagnosis for a deployed instance. Reports configuration presence
 * (never values), database reachability, and — when signed in — runs each
 * dashboard query separately so a failure names the exact step.
 *
 * Deliberately leaks nothing: no secrets, no task names, no notes; only
 * booleans, counts, timings and error messages.
 */
export async function GET() {
  const steps: Record<string, unknown>[] = [];
  const started = Date.now();

  async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
    const t = Date.now();
    try {
      const value = await fn();
      steps.push({ step: name, ok: true, ms: Date.now() - t });
      return value;
    } catch (err) {
      const e = err as Error;
      steps.push({
        step: name,
        ok: false,
        ms: Date.now() - t,
        error: e?.message ?? String(err),
        type: e?.constructor?.name ?? typeof err,
        at: (e?.stack ?? "").split("\n").slice(1, 4).map((l) => l.trim()),
      });
      return undefined;
    }
  }

  const url = process.env.TURSO_DATABASE_URL ?? "";
  const config = {
    TURSO_DATABASE_URL: url ? `set (${url.split(":")[0]}://…)` : "MISSING — falling back to a local file",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "set" : "MISSING",
    CADENCE_SESSION_SECRET: process.env.CADENCE_SESSION_SECRET ? "set" : "MISSING",
    CADENCE_INVITE_CODE: process.env.CADENCE_INVITE_CODE ? "set" : "not set (a random code was generated)",
    node: process.version,
    region: process.env.VERCEL_REGION ?? "local",
  };

  await step("intl-timezones", async () => {
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
  });
  await step("db-connect", async () => { await get("SELECT 1 AS ok"); });
  const tables = await step("db-schema", async () =>
    (await all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")).length
  );
  const counts = await step("db-counts", async () => ({
    users: (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users"))?.n,
    groups: (await get<{ n: number }>("SELECT COUNT(*) AS n FROM groups"))?.n,
  }));

  const user = await step("session", async () => await getSessionUser());

  if (user) {
    const tz = user.timezone;
    const today = todayInTz(tz);
    steps.push({ step: "user", ok: true, username: user.username, timezone: tz, resolvedToday: today });

    // Each dashboard data source, separately — a failure names the culprit.
    await step("dash:daySummaryFor", async () => { await daySummaryFor(user.id, today, tz); });
    await step("dash:sharedToday", async () => { await sharedToday(user.id); });
    await step("dash:getGroupForUser", async () => { await getGroupForUser(user.id); });
    await step("dash:countdownEvents", async () => { await countdownEvents(user.id, today); });
    await step("dash:upcomingEvents", async () => { await upcomingEvents(user.id, today, 5); });
    await step("dash:summariesForRange", async () => {
      await summariesForRange(user.id, addDays(today, -13), today, tz);
    });
    await step("dash:allGoalStats", async () => { await allGoalStats(user.id, today); });
  }

  const failed = steps.filter((s) => s.ok === false);
  return Response.json(
    {
      status: failed.length ? "FAILING" : "ok",
      summary: failed.length
        ? `${failed.length} step(s) failed — see "steps" below`
        : user
          ? "Everything the dashboard needs works."
          : "Core checks pass. Sign in, then reload this page to test the dashboard queries.",
      totalMs: Date.now() - started,
      tablesFound: tables ?? null,
      counts: counts ?? null,
      config,
      steps,
    },
    { status: failed.length ? 500 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
