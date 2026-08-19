"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  // Controlled: React resets the form after the action, which would clear the
  // username on every failed attempt.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="fade-up w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft font-display text-2xl font-semibold text-accent-ink">
            C
          </span>
          <h1 className="font-display text-3xl font-medium">Cadence</h1>
          <p className="mt-2 text-sm text-ink-2">
            Plan the day. Keep the goals. Grow together.
          </p>
        </div>
        <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-6" style={{ boxShadow: "var(--shadow)" }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" autoFocus required
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
          <Button className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-3">
          New here?{" "}
          <Link href="/join" className="font-medium text-accent-ink hover:underline">
            Join with an invite code
          </Link>
        </p>
      </div>
    </div>
  );
}
