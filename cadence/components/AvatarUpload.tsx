"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatarAction } from "@/app/actions";
import { Button } from "./ui";
import { IconUpload } from "./icons";

const MAX_EDGE = 512;      // an avatar is never shown bigger than this
const TARGET_BYTES = 900_000;

/**
 * Photos straight off a phone are several megabytes, and the upload used to
 * discard them without a word. The picture is now scaled down in the browser
 * first, so what gets sent is small whatever the camera produced — and
 * anything that still goes wrong says so.
 */
export default function AvatarUpload({ hasAvatar }: { hasAvatar: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shrink = (file: File) =>
    new Promise<Blob>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        const attempt = (quality: number) =>
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("encode failed"));
              if (blob.size > TARGET_BYTES && quality > 0.5) return attempt(quality - 0.15);
              resolve(blob);
            },
            "image/jpeg",
            quality
          );
        attempt(0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Chrome and Firefox cannot decode iPhone HEIC files.
        reject(new Error("unreadable"));
      };
      img.src = url;
    });

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const small = await shrink(file);
      const fd = new FormData();
      fd.set("avatar", new File([small], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadAvatarAction(fd);
      if (res && "error" in res) setError(res.error);
      else router.refresh();
    } catch (err) {
      setError(
        (err as Error).message === "unreadable"
          ? "That file couldn't be read as a picture. iPhone HEIC photos often can't be — " +
            "open it, choose Share, and save it as a JPEG first."
          : "Couldn't process that picture. Try another one."
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
          }}
        />
        <Button
          variant="soft" className="!py-1.5" type="button"
          disabled={busy} onClick={() => input.current?.click()}
        >
          <IconUpload size={13} /> {busy ? "Uploading…" : hasAvatar ? "Change photo" : "Upload photo"}
        </Button>
      </div>
      {error && <p className="max-w-xs text-[11px] leading-relaxed text-danger">{error}</p>}
      {!error && (
        <p className="text-[11px] text-ink-3">Any size — it&apos;s resized here before sending.</p>
      )}
    </div>
  );
}
