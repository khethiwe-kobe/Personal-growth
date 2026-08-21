"use client";

import { useEffect, useRef, useState } from "react";

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
  const ready = useRef<{ key: string; blob: Blob } | null>(null);

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

  // Prepare today's picture up front so a press can share it straight away.
  useEffect(() => {
    let cancelled = false;
    const key = `day:${date}:${withNames}`;
    fetch(`/api/share/day?date=${encodeURIComponent(date)}${withNames ? "" : "&labels=off"}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => { if (blob && !cancelled) ready.current = { key, blob }; })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date, withNames]);

  const fileNameFor = (range: Range) => `cadence-${range}-${date}.png`;

  const handOver = async (range: Range, blob: Blob) => {
    const file = new File([blob], fileNameFor(range), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My day" });
        setNote("Sent. Choose Save Image to keep it in your photos.");
        return true;
      } catch {
        // Cancelled, or the browser refused — fall back to saving.
      }
    }
    return false;
  };

  const build = async (range: Range) => {
    setBusy(range); setError(null); setNote(null);
    try {
      const key = `day:${date}:${withNames}`;
      // Today's picture is usually already prepared, which keeps the press
      // inside the gesture iOS requires for sharing.
      const cached = range === "day" && ready.current?.key === key ? ready.current.blob : null;
      let blob = cached;
      if (!blob) {
        const names = withNames ? "" : "&labels=off";
        const endpoint =
          range === "day"
            ? `/api/share/day?date=${encodeURIComponent(date)}${names}`
            : `/api/share/period?range=${range}${names}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(String(res.status));
        blob = await res.blob();
      }

      const shared = await handOver(range, blob);
      if (shot) URL.revokeObjectURL(shot.url);
      const url = URL.createObjectURL(blob);
      setShot({ url, blob, range });
      if (!shared) {
        // No share sheet here (most desktops): save the file instead.
        const a = document.createElement("a");
        a.href = url;
        a.download = fileNameFor(range);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNote("Saved to your downloads. It's also below if you'd rather copy it.");
      }
    } catch {
      setError("Couldn't build the picture. Reload the page and try again.");
    } finally {
      setBusy(null);
    }
  };

  const fileName = () => fileNameFor(shot?.range ?? "day");

  const share = async () => {
    if (!shot) return;
    await handOver(shot.range, shot.blob);
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
        <span className="text-[11px] text-ink-3">
          {canShare ? "Save or send a picture of:" : "Picture of:"}
        </span>
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
