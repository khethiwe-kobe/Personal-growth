"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/actions";
import { Button } from "@/components/ui";

export default function JoinPage() {
  const [state, action, pending] = useActionState(signupAction, null as { error?: string } | null);
  const [tz, setTz] = useState("Africa/Johannesburg");
  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {}
  }, []);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="fade-up w-full max-w-sm">
        <h1 className="mb-1 text-center font-display text-3xl font-medium">Join your group</h1>
        <p className="mb-6 text-center text-sm text-ink-2">
          You'll need the invite code from your accountability group.
        </p>
        <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-6" style={{ boxShadow: "var(--shadow)" }}>
          <input type="hidden" name="timezone" value={tz} />
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Invite code</label>
            <input name="invite" placeholder="e.g. GROW-TOGETHER" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Your name</label>
            <input name="display_name" autoComplete="name" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Username</label>
            <input name="username" autoComplete="username" pattern="[a-zA-Z0-9_.-]{2,40}" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Password (min 8 characters)</label>
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">I am…</label>
            <select name="role" defaultValue="student">
              <option value="student">A student</option>
              <option value="working">Working</option>
            </select>
          </div>
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
          <Button className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create my account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-3">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-ink hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
