"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clearLegacyData, legacyData, replaceState, setSession, useSession } from "@/lib/store";
import { hydrateState, isEmptyState } from "@/lib/state";
import type { Member } from "@/lib/types";

/** Only members of the JHB group get past this: sign in, or join with the group's code. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, me } = useSession();
  const [legacy, setLegacy] = useState<unknown>(null);

  useEffect(() => {
    (async () => {
      try {
        const { member } = await api<{ member: Member | null }>("/api/auth");
        if (!member) return setSession("signed_out", null);
        setSession("ready", member);
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) setSession("no_database", null);
        else setSession("signed_out", null);
      }
    })();
  }, []);

  // Whenever someone is signed in, load their data from the server.
  useEffect(() => {
    if (status !== "ready" || !me) return;
    (async () => {
      try {
        const { state } = await api<{ state: unknown }>("/api/state");
        replaceState(state);
        const old = legacyData();
        if (old && isEmptyState(hydrateState(state)) && !isEmptyState(hydrateState(old))) setLegacy(old);
      } catch {
        // Offline: the cached copy stays on screen.
      }
    })();
  }, [status, me]);

  if (status === "loading") return <div className="min-h-dvh" />;
  if (status === "no_database") return <Setup />;
  if (status === "signed_out" || !me) return <SignIn />;

  return (
    <>
      {legacy !== null && (
        <ImportBanner
          onDone={() => {
            clearLegacyData();
            setLegacy(null);
          }}
          data={legacy}
        />
      )}
      {children}
    </>
  );
}

function ImportBanner({ data, onDone }: { data: unknown; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const bring = async () => {
    setBusy(true);
    try {
      const res = await api<{ state: unknown }>("/api/state", { method: "PUT", body: JSON.stringify({ state: data, mode: "import" }) });
      replaceState(res.state);
    } finally {
      onDone();
    }
  };
  return (
    <div className="bg-accent-soft text-accent-ink text-sm px-4 py-3 flex flex-wrap items-center justify-center gap-3">
      <span>This device has coaching progress from before accounts existed. Add it to your account?</span>
      <button className="btn btn-primary !py-1 !px-3 !text-xs" disabled={busy} onClick={bring}>
        Add it
      </button>
      <button className="btn btn-ghost !py-1 !px-3 !text-xs" disabled={busy} onClick={onDone}>
        Discard
      </button>
    </div>
  );
}

function Setup() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-6">
        <div className="serif text-2xl">RD Coach</div>
        <p className="text-ink-2 text-sm mt-2 leading-relaxed">
          The app is not connected to its database yet. In the Vercel project, open Storage, create a Neon Postgres database
          and connect it to this project, then redeploy.
        </p>
      </div>
    </div>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"signin" | "join">("signin");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { member } =
        mode === "join"
          ? await api<{ member: Member }>("/api/auth/join", { method: "POST", body: JSON.stringify({ code, name, username, password }) })
          : await api<{ member: Member }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setSession("ready", member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 fade-in">
        <div className="serif text-2xl">RD Coach</div>
        <p className="text-ink-2 text-sm mt-1.5 leading-relaxed">
          {mode === "signin" ? "Sign in to the JHB training group." : "Join the JHB training group with the code you were given."}
        </p>

        <div className="flex flex-col gap-3 mt-5">
          {mode === "join" && (
            <>
              <input className="input" placeholder="Group join code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
              <input className="input" placeholder="Your name, as the group will see it" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </>
          )}
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "join" ? "new-password" : "current-password"}
          />
        </div>

        {error && <div className="text-sm text-danger mt-3">{error}</div>}

        <button className="btn btn-primary w-full mt-4" disabled={busy || !username || !password || (mode === "join" && (!code || !name))}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Join the group"}
        </button>

        <p className="text-sm text-ink-3 mt-4 text-center">
          {mode === "signin" ? "New here? " : "Already a member? "}
          <button
            type="button"
            className="text-accent-ink underline"
            onClick={() => {
              setMode(mode === "signin" ? "join" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Join with a code" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
