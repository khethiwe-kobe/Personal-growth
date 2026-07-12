"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Check, Field, Input, PageTitle, SectionTitle } from "@/components/ui";
import { exportBundle, importBundle, useStore } from "@/lib/storage";
import type { AppSettings, Reminders } from "@/lib/types";
import { backupToCloud, currentUserEmail, restoreFromCloud, signInWithEmail, signOut, supabaseConfigured } from "@/lib/supabase";

const DEFAULT_SETTINGS: AppSettings = {
  name: "Khethiwe",
  reminders: { bible: true, workout: true, meals: true, weeklyReview: true, monthlyReview: true, goals: true },
  dailyFocus: {},
};

const REMINDER_LABELS: { key: keyof Reminders; label: string }[] = [
  { key: "bible", label: "Bible reading" },
  { key: "workout", label: "Workout" },
  { key: "meals", label: "Meal planning" },
  { key: "weeklyReview", label: "Weekly review" },
  { key: "monthlyReview", label: "Monthly review" },
  { key: "goals", label: "Goal deadlines" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useStore<AppSettings>("settings", DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<string>("unsupported");
  const fileRef = useRef<HTMLInputElement>(null);
  const configured = supabaseConfigured();

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifState(Notification.permission);
    if (configured) currentUserEmail().then(setSignedInAs);
  }, [configured]);

  function download() {
    const blob = new Blob([exportBundle()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal-growth-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const n = importBundle(await file.text());
      setMessage(`Restored ${n} data sections from backup.`);
    } catch {
      setMessage("That file does not look like a valid backup.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Settings" subtitle="Your name, your reminders, and the safety of your data." />

      <Card className="mb-6">
        <SectionTitle>Profile</SectionTitle>
        <Field label="Your first name (used in greetings)">
          <Input value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} placeholder="Your name" />
        </Field>
      </Card>

      <Card className="mb-6">
        <SectionTitle>Reminders</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-soft">
          Choose what the Companion may nudge you about on the dashboard. Browser notifications, when allowed, remind
          you while the app is open.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {REMINDER_LABELS.map(({ key, label }) => (
            <Check
              key={key}
              checked={settings.reminders[key]}
              onChange={(v) => setSettings((s) => ({ ...s, reminders: { ...s.reminders, [key]: v } }))}
              label={label}
            />
          ))}
        </div>
        <div className="mt-5 border-t border-line-soft pt-4">
          {notifState === "unsupported" ? (
            <p className="text-sm text-faint">This browser does not support notifications.</p>
          ) : notifState === "granted" ? (
            <p className="text-sm text-soft">Browser notifications are enabled.</p>
          ) : (
            <Button
              variant="ghost"
              onClick={async () => {
                const p = await Notification.requestPermission();
                setNotifState(p);
                if (p === "granted") new Notification("Selah", { body: "Reminders are on. Grow in grace today." });
              }}
            >
              Enable browser notifications
            </Button>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <SectionTitle>Backup &amp; restore</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-soft">
          Everything you write is saved on this device automatically. Download a backup file to keep it safe or move it
          to another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>Download backup</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Restore from file
          </Button>
        </div>
        {message && <p className="mt-3 text-sm text-brown-deep">{message}</p>}
      </Card>

      <Card>
        <SectionTitle>Cloud sync (Supabase)</SectionTitle>
        {!configured ? (
          <p className="text-sm leading-relaxed text-soft">
            Cloud sync is not configured yet. Create a free Supabase project, run the SQL in{" "}
            <code className="rounded bg-beige px-1.5 py-0.5 text-xs">supabase/schema.sql</code>, and set{" "}
            <code className="rounded bg-beige px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-beige px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — full steps
            are in the README. The app works fully offline without it.
          </p>
        ) : signedInAs ? (
          <div>
            <p className="mb-4 text-sm text-soft">
              Signed in as <span className="text-ink">{signedInAs}</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  const r = await backupToCloud();
                  setMessage(r.error ? r.error : "Backed up to the cloud.");
                }}
              >
                Back up now
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const r = await restoreFromCloud();
                  setMessage(r.error ? r.error : `Restored ${r.keys} data sections from the cloud.`);
                }}
              >
                Restore from cloud
              </Button>
              <Button
                variant="quiet"
                onClick={async () => {
                  await signOut();
                  setSignedInAs(null);
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-soft">Sign in with a magic link to back up your data to your own Supabase project.</p>
            <div className="flex gap-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <Button
                onClick={async () => {
                  const r = await signInWithEmail(email);
                  setMessage(r.error ? r.error : "Check your email for the sign-in link.");
                }}
                disabled={!email.includes("@")}
              >
                Send link
              </Button>
            </div>
            {message && <p className="mt-3 text-sm text-brown-deep">{message}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
