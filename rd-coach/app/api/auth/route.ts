import { failure, json } from "@/lib/server/http";
import { currentMember } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in on this device (null when nobody is). */
export async function GET(req: Request) {
  try {
    return json({ member: await currentMember(req) });
  } catch (err) {
    return failure(err);
  }
}
