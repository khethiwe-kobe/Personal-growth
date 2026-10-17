import { failure, json } from "@/lib/server/http";
import { clearSessionCookie, endSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await endSession(req);
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (err) {
    return failure(err);
  }
}
