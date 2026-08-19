"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/actions";
import { Button } from "@/components/ui";

/**
 * Fields are controlled: React resets a form after a server action runs, which
 * would otherwise wipe everything the moment one field is wrong.
 */
export default function JoinPage() {
  const [state, action, pending] = useActionState(signupAction, null as { error?: string } | null);
  const [tz, setTz] = useState("Africa/Johannesburg");
  const [f, setF] = useState({
    invite: "", display_name: "", username: "", password: "", role: "student",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

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
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="invite">Invite code</label>
            <input id="invite" name="invite" value={f.invite} onChange={set("invite")}
              placeholder="e.g. GROW-TOGETHER" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="display_name">Your name</label>
            <input id="display_name" name="display_name" autoComplete="name"
              value={f.display_name} onChange={set("display_name")} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username"
              pattern="[a-zA-Z0-9_.\-]{2,40}" value={f.username} onChange={set("username")} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="password">
              Password (min 8 characters)
            </label>
            <input id="password" name="password" type="password" autoComplete="new-password"
              minLength={8} value={f.password} onChange={set("password")} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="role">I am…</label>
            <select id="role" name="role" value={f.role} onChange={set("role")}>
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
