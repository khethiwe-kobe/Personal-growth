"use client";

import { useEffect, useState } from "react";

type Range = "day" | "week" | "month";
const LABEL: Record<Range, string> = { day: "This day", week: "This week", month: "This month" };

/**
 * Turns the day, week or month into a picture and shows it right here.
 *
 * Deliberately not a file download: on a phone that means hunting through the
 * Files app before you can send anything. The image appears inline, and where
 * the browser supports it, Share hands it straight to WhatsApp. Copy and Save
 * are there for desktop, and the picture itself can always be long-pressed or
 * right-clicked like any other image.
 */
export default function ShareDay({ date }: { date: string }) {
  const [withNames, setWithNames] = useState(true);
  const [busy, setBusy] = useState<Range | null>(null);
  const [shot, setShot] = useState<{ url: string; blob: Blob; range: Range } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Feature-detected rather than assumed: file sharing is mobile-mostly.
    const probe = new File([new Blob(["x"])], "x.png", { type: "image/png" });
    setCanShare(
      typeof navigator !== "undefined" &&
        !!navigator.canShare &&
        navigator.canShare({ files: [probe] })
    );
  }, []);

  // Don't leak the previous object URL when a new picture replaces it.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const build = async (range: Range) => {
    setBusy(range); setError(null); setNote(null);
    try {
      const names = withNames ? "" : "&labels=off";
      const endpoint =
        range === "day"
          ? `/api/share/day?date=${encodeURIComponent(date)}${names}`
          : `/api/share/period?range=${range}${names}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (shot) URL.revokeObjectURL(shot.url);
      setShot({ url: URL.createObjectURL(blob), blob, range });
    } catch {
      setError("Couldn't build the picture. Reload the page and try again.");
    } finally {
      setBusy(null);
    }
  };

  const fileName = () => `cadence-${shot?.range ?? "day"}-${date}.png`;

  const share = async () => {
    if (!shot) return;
    try {
      await navigator.share({
        files: [new File([shot.blob], fileName(), { type: "image/png" })],
        title: "My day",
      });
    } catch {
      // A cancelled share sheet throws too — nothing worth reporting.
    }
  };

  const copy = async () => {
    if (!shot) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": shot.blob })]);
      setNote("Copied — paste it straight into the chat.");
    } catch {
      setNote("Your browser wouldn't allow copying. Right-click the picture instead.");
    }
  };

  const save = () => {
    if (!shot) return;
    const a = document.createElement("a");
    a.href = shot.url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-ink-3">Picture of:</span>
        {(["day", "week", "month"] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => build(r)}
            disabled={busy !== null}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-line-2 disabled:opacity-50"
          >
            {busy === r ? "Building…" : LABEL[r]}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <input type="checkbox" checked={withNames}
            onChange={(e) => setWithNames(e.target.checked)} />
          include task names
        </label>
      </div>

      {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}

      {shot && (
        <div className="fade-up mt-3 rounded-2xl border border-line bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {canShare && (
              <button type="button" onClick={share}
                className="rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink">
                Share
              </button>
            )}
            <button type="button" onClick={copy}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2">
              Copy image
            </button>
            <button type="button" onClick={save}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2">
              Save
            </button>
            <button type="button" onClick={() => { setShot(null); setNote(null); }}
              className="ml-auto text-[11px] text-ink-3 hover:text-ink-2">
              Close
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.url}
            alt={`Your ${shot.range}`}
            className="w-full rounded-xl border border-line"
          />
          <p className="mt-2 text-[11px] text-ink-3">
            {note ??
              (canShare
                ? "Share sends it straight to another app. On a phone you can also press and hold the picture."
                : "Copy it and paste into the chat, or press and hold the picture to save it.")}
          </p>
        </div>
      )}
    </div>
  );
}
