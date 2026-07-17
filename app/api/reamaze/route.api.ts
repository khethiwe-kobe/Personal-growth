import { NextResponse } from "next/server";
import {
  reamazeConfigured,
  reamazePing,
  createConversation,
} from "@/lib/reamaze";

// Talks to the Re:amaze API using the secret token, so it must run on the
// server (Node) — never a static export. Hosts like Vercel, `next start`,
// or `next dev` provide the runtime; the GitHub Pages static build does not
// include this route (see README → "Optional: Re:amaze support integration").
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reamaze — configuration + token health check. */
export async function GET() {
  if (!reamazeConfigured()) {
    return NextResponse.json({ configured: false });
  }
  const ping = await reamazePing();
  return NextResponse.json(
    { configured: true, ...ping },
    { status: ping.ok ? 200 : 502 }
  );
}

/**
 * POST /api/reamaze — open a support conversation.
 * Body: { name, email, subject, message, category? }
 */
export async function POST(req: Request) {
  if (!reamazeConfigured()) {
    return NextResponse.json(
      { error: "Re:amaze is not configured on the server." },
      { status: 503 }
    );
  }

  let payload: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    category?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, subject, message, category } = payload;
  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "name, email, subject and message are required." },
      { status: 400 }
    );
  }

  try {
    const conversation = await createConversation({
      subject,
      message,
      category,
      contact: { name, email },
    });
    return NextResponse.json({ ok: true, conversation }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 }
    );
  }
}
