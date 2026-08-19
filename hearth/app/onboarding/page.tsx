"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Button, ErrorNote, Field, Input, Segmented } from "@/components/ui";

export default function OnboardingPage() {
  const { sb, user, household, loading, refresh } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Our home");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (household) router.replace("/");
  }, [loading, user, household, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } =
      mode === "create"
        ? await sb.rpc("create_household", { p_name: name.trim() || "Our home" })
        : await sb.rpc("join_household", { p_code: code.trim() });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    await refresh();
    setBusy(false);
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your household</h1>
          <p className="mt-1 text-sm text-muted">
            The first person creates the household; the second joins with the invite code.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div className="flex justify-center">
            <Segmented
              options={[
                { value: "create", label: "Create household" },
                { value: "join", label: "Join with code" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
          {mode === "create" ? (
            <Field label="Household name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          ) : (
            <Field label="Invite code" hint="Ask the person who created the household — it is shown in Settings.">
              <Input
                required
                placeholder="e.g. 4F7A2C"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </Field>
          )}
          <ErrorNote>{error || null}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "One moment…" : mode === "create" ? "Create" : "Join"}
          </Button>
        </form>
      </div>
    </div>
  );
}
