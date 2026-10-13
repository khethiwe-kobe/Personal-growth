import { bad, failure, json, readJson } from "@/lib/server/http";
import { findLogin, slowly, startSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ username?: unknown; password?: unknown }>(req);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const member = username && password ? await findLogin(username, password) : null;
    if (!member) return slowly(bad("Username or password is not right.", 401));
    return json({ member }, 200, { "Set-Cookie": await startSession(member.id) });
  } catch (err) {
    return failure(err);
  }
}
