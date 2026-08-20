"use client";

import { useState } from "react";

/**
 * Downloads the day as a PNG for sharing outside the app — the group chat
 * where schedules get compared. Names can be left out, so a schedule is
 * shareable without publishing what is actually on it.
 */
export default function ShareDay({ date }: { date: string }) {
  const [withNames, setWithNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/share/day?date=${encodeURIComponent(date)}${withNames ? "" : "&labels=off"}`
      );
      if (!res.ok) throw new Error(String(res.status));
      // Fetch as a blob so the file saves rather than opening in a tab.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cadence-${date}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't build the image. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-line-2 disabled:opacity-50"
      >
        {busy ? "Building image…" : "Download as image"}
      </button>
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
