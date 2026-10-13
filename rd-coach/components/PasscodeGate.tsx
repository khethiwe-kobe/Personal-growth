"use client";

import { useEffect, useState } from "react";
import { getState, setState, useCoachState } from "@/lib/store";

type Status = "checking" | "open" | "locked" | "ok" | "offline";

/**
 * Shared deployments set COACH_PASSCODE on the server. People enter it once
 * per device; it is checked by the server on every coach request.
 */
export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const { settings } = useCoachState();
  const [status, setStatus] = useState<Status>("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        const { required } = (await res.json()) as { required?: boolean };
        if (cancelled) return;
        // Read the store directly: on the first render the hook still returns
        // the server snapshot, which has no passcode.
        setStatus(required ? (getState().settings.passcode ? "ok" : "locked") : "open");
      } catch {
        // Offline: let people see their own data; coach requests will say why they fail.
        if (!cancelled) setStatus("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A rejected passcode is cleared by the client; lock again when that happens.
  const locked = status === "locked" || (status === "ok" && !settings.passcode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passcode = value.trim();
    if (!passcode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        setState((s) => ({ ...s, settings: { ...s.settings, passcode } }));
        setStatus("ok");
        setValue("");
      } else {
        setError("That passcode is not right.");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") {
    return <div className="min-h-dvh" />;
  }

  if (locked) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <form onSubmit={submit} className="card w-full max-w-sm p-6 fade-in">
          <div className="serif text-2xl">RD Coach</div>
          <p className="text-ink-2 text-sm mt-2 leading-relaxed">
            Enter the passcode you were given. You only need to do this once on each device.
          </p>
          <input
            className="input mt-5"
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="Passcode"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <div className="text-sm text-danger mt-2">{error}</div>}
          <button className="btn btn-primary w-full mt-4" disabled={busy || !value.trim()}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <p className="text-xs text-ink-3 mt-4 leading-relaxed">
            Your training data stays on this device and is never shared with other people using the app.
          </p>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
