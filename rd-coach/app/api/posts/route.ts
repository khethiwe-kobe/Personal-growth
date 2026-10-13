import { bad, json, withMember } from "@/lib/server/http";
import { createPhotoPost, MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/server/social";
import { dayOf } from "@/lib/time";

export const runtime = "nodejs";

/** Post a progress photo (multipart form: photo, caption). */
export async function POST(req: Request) {
  return withMember(req, async (me) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return bad("Could not read the upload.");
    }
    const file = form.get("photo");
    const caption = String(form.get("caption") ?? "").trim().slice(0, 500);
    if (!(file instanceof Blob) || file.size === 0) return bad("Choose a photo first.");
    if (!PHOTO_TYPES.includes(file.type)) return bad("Photos must be JPEG, PNG or WebP.");
    if (file.size > MAX_PHOTO_BYTES) return bad("That photo is too large. Try another one.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = await createPhotoPost(me.id, dayOf(), file.type, bytes, caption);
    return json({ id });
  });
}
