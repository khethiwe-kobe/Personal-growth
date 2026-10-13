"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/** Shrink a photo on the device before upload: max 1440 px on the long side, JPEG. */
async function compress(file: File, max = 1440, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file could not be read as a photo."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Take a photo with the camera or pick one, add a caption, and post it to the team feed. */
export function PhotoComposer({ onPosted, onClose }: { onPosted: () => void; onClose?: () => void }) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await compress(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that photo.");
    }
  };

  const post = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", photo, "progress.jpg");
      form.append("caption", caption.trim());
      await api("/api/posts", { method: "POST", body: form });
      setPhoto(null);
      setPreview(null);
      setCaption("");
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 fade-in">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg">Today&apos;s progress photo</h3>
        {onClose && (
          <button className="text-sm text-ink-3 hover:text-ink" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {preview ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Progress photo preview" className="w-full max-h-[60vh] object-contain rounded-lg bg-surface-2" />
          <textarea
            className="input"
            rows={2}
            maxLength={500}
            placeholder="Add a caption: how the session went, how you feel"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setPhoto(null);
                setPreview(null);
              }}
            >
              Choose another
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={post}>
              {busy ? "Posting…" : "Post to the team"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
            Take photo
          </button>
          <button className="btn btn-ghost" onClick={() => galleryRef.current?.click()}>
            Upload from gallery
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
      <p className="text-xs text-ink-3 mt-3">Photos are only visible to signed-in members of the JHB group.</p>
    </div>
  );
}
