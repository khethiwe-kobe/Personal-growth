"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const { sb, user, household, loading } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (loading) return;
    if (user) router.replace(household ? "/" : "/onboarding");
  }, [loading, user, household, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), display_name: fullName.trim().split(" ")[0] } },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setError(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Hearth</h1>
          <p className="mt-1 text-sm text-muted">Your shared household budget</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          {mode === "signup" && (
            <Field label="Full name">
              <Input
                required
                placeholder="e.g. Khethiwe Kobe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorNote>{error || null}</ErrorNote>
          {notice ? <p className="text-sm text-good">{notice}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted hover:text-ink"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
