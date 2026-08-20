"use client";

import { useState } from "react";

/**
 * Downloads the day, week or month as a PNG for sharing outside the app — the
 * group chat where schedules get compared. Names can be left out, so a
 * schedule is shareable without publishing what is actually on it.
 */
type Range = "day" | "week" | "month";

const LABEL: Record<Range, string> = { day: "This day", week: "This week", month: "This month" };

export default function ShareDay({ date }: { date: string }) {
  const [withNames, setWithNames] = useState(true);
  const [busy, setBusy] = useState<Range | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (range: Range) => {
    setBusy(range);
    setError(null);
    try {
      const names = withNames ? "" : "&labels=off";
      const endpoint =
        range === "day"
          ? `/api/share/day?date=${encodeURIComponent(date)}${names}`
          : `/api/share/period?range=${range}${names}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(String(res.status));
      // Fetch as a blob so the file saves rather than opening in a tab.
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `cadence-${range}-${date}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Couldn't build the image. Reload the page and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-ink-3">Download as image:</span>
      {(["day", "week", "month"] as Range[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => download(r)}
          disabled={busy !== null}
          className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-line-2 disabled:opacity-50"
        >
          {busy === r ? "Building…" : LABEL[r]}
        </button>
      ))}
      <label className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <input
          type="checkbox"
          checked={withNames}
          onChange={(e) => setWithNames(e.target.checked)}
        />
        include task names
      </label>
      {error && <p className="w-full text-[11px] text-danger">{error}</p>}
    </div>
  );
}
