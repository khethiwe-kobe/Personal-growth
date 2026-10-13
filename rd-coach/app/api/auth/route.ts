import { passcodeDenied, passcodeRequired, passcodeValid } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether this deployment needs a passcode. */
export async function GET() {
  return Response.json({ required: passcodeRequired() });
}

/** Check a passcode before the app stores it on the device. */
export async function POST(req: Request) {
  let passcode: unknown;
  try {
    passcode = ((await req.json()) as { passcode?: unknown }).passcode;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!passcodeValid(passcode)) return passcodeDenied();
  return Response.json({ ok: true });
}
