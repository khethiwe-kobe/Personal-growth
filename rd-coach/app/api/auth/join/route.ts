import { passcodeRequired, passcodeValid } from "@/lib/server/auth";
import { bad, failure, json, readJson } from "@/lib/server/http";
import { USERNAME_RE, createMember, slowly, startSession } from "@/lib/server/session";
import { sql } from "@/lib/server/db";

export const runtime = "nodejs";

/** Create an account. Only people with the JHB join code can. */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ code?: unknown; name?: unknown; username?: unknown; password?: unknown }>(req);
    if (!body) return bad("Invalid request.");
    if (!passcodeRequired()) return bad("Joining is closed: the group's join code (COACH_PASSCODE) has not been set.", 403);
    if (!passcodeValid(body.code)) return slowly(bad("That join code is not right.", 403));

    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (name.length < 1 || name.length > 40) return bad("Enter your name (up to 40 characters).");
    if (!USERNAME_RE.test(username)) return bad("Usernames are 3 to 24 characters: letters, numbers, dots, dashes or underscores.");
    if (password.length < 6) return bad("Use a password of at least 6 characters.");

    const taken = await sql("SELECT 1 FROM members WHERE username = $1", [username]);
    if (taken.length) return bad("That username is taken. Try another.", 409);

    const member = await createMember(username, name, password);
    const cookie = await startSession(member.id);
    return json({ member }, 200, { "Set-Cookie": cookie });
  } catch (err) {
    return failure(err);
  }
}
