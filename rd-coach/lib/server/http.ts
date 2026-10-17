import { requireMember, Unauthorized } from "./session";
import type { Member } from "../types";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Run a handler for the signed-in member; turns common failures into clear JSON errors. */
export async function withMember(req: Request, handler: (m: Member) => Promise<Response>): Promise<Response> {
  try {
    const member = await requireMember(req);
    return await handler(member);
  } catch (err) {
    return failure(err);
  }
}

export function failure(err: unknown): Response {
  if (err instanceof Unauthorized) return json({ error: "Please sign in.", code: "signed_out" }, 401);
  const message = err instanceof Error ? err.message : "Something went wrong.";
  if (/database is not connected/i.test(message)) return json({ error: message, code: "no_database" }, 503);
  console.error(err);
  return json({ error: "Something went wrong on the server. Please try again." }, 500);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
