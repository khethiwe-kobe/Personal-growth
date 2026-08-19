import { requireUser, getGroupForUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { categoriesFor } from "@/lib/repo";
import { PageTitle, Card, SectionHeading, Button } from "@/components/ui";
import Avatar from "@/components/Avatar";
import {
  ProfileForm, AppearancePicker, PasswordForm, CategoryManager,
} from "@/components/SettingsClient";
import {
  uploadAvatarAction, removeAvatarAction, logoutAction,
  saveNotificationPrefsAction, resetDemoDataAction, reseedDemoDataAction,
} from "@/app/actions";
import { IconLogout, IconUpload } from "@/components/icons";

export const metadata = { title: "Profile & Settings" };
export const dynamic = "force-dynamic";

const NOTIF_OPTIONS: [string, string][] = [
  ["daily_planning", "Morning nudge to plan the day"],
  ["uncompleted_tasks", "Evening reminder about unfinished tasks"],
  ["goal_actions", "Daily goal actions still open"],
  ["calendar_events", "Calendar event reminders"],
  ["deadlines", "Upcoming deadlines"],
  ["monthly_review", "Monthly review time"],
  ["focus_sessions", "Focus session start/end"],
  ["streaks", "Streak at risk"],
];

export default async function SettingsPage() {
  const user = await requireUser();
  const [group, categories, me, settings] = await Promise.all([
    getGroupForUser(user.id),
    categoriesFor(user.id),
    get<{ is_demo: number }>("SELECT is_demo FROM users WHERE id=?", [user.id]),
    get<{ notification_prefs: string }>(
      "SELECT notification_prefs FROM user_settings WHERE user_id=?", [user.id]
    ),
  ]);
  let prefs: Record<string, boolean> = {};
  try { prefs = JSON.parse(settings?.notification_prefs || "{}"); } catch {}

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <PageTitle title="Profile & Settings" />

      <SectionHeading>Profile</SectionHeading>
      <Card>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.display_name} accent={user.accent}
            userId={user.id} hasAvatar={user.has_avatar} size={64} />
          <div className="flex flex-wrap gap-2">
            <form action={uploadAvatarAction} className="flex items-center gap-2">
              <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp"
                required className="!w-auto text-xs" />
              <Button variant="soft" className="!py-1.5"><IconUpload size={13} /> Upload</Button>
            </form>
            {user.has_avatar && (
              <form action={removeAvatarAction}>
                <Button variant="ghost" className="!py-1.5">Remove photo</Button>
              </form>
            )}
          </div>
        </div>
        <ProfileForm user={user} />
      </Card>

      <SectionHeading>Appearance</SectionHeading>
      <Card>
        <AppearancePicker current={user.appearance} />
        <p className="mt-2 text-[11px] text-ink-3">
          Saved to your account — it follows you across devices.
        </p>
      </Card>

      <SectionHeading>Categories</SectionHeading>
      <Card>
        <CategoryManager categories={categories} />
      </Card>

      <SectionHeading>Notifications</SectionHeading>
      <Card>
        <form action={saveNotificationPrefsAction} className="space-y-2.5">
          {NOTIF_OPTIONS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name={key} defaultChecked={prefs[key] ?? (key === "deadlines" || key === "monthly_review")} />
              {label}
            </label>
          ))}
          <Button variant="soft" className="mt-2">Save preferences</Button>
          <p className="text-[11px] leading-relaxed text-ink-3">
            Honesty first: these are in-app and browser notifications. Browser notifications only
            work while the site is open (or installed), and only after you grant permission —
            the Focus page asks when needed. No emails, no SMS.
          </p>
        </form>
      </Card>

      <SectionHeading>Your data</SectionHeading>
      <Card>
        <p className="text-sm text-ink-2">
          Everything you own — tasks, goals, check-ins, events, timetable, focus
          history and monthly reviews, private notes included — as one JSON file.
          Nothing here is ever deleted by the app; keep a copy anyway.
        </p>
        <a
          href="/api/export"
          download
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-transparent bg-accent-soft px-3.5 py-2 text-sm font-medium text-accent-ink"
        >
          Download a full backup
        </a>
      </Card>

      <SectionHeading>Security</SectionHeading>
      <Card>
        <PasswordForm />
      </Card>

      {group && (
        <>
          <SectionHeading>Your group</SectionHeading>
          <Card>
            <p className="text-sm font-medium">{group.group.name}</p>
            <p className="mt-1 text-xs text-ink-3">
              Invite code: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{group.group.invite_code}</code>
              {" "}— share it to add a member.
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={m.display_name} accent={m.accent} userId={m.id}
                    hasAvatar={m.has_avatar} size={26} />
                  {m.display_name}
                  {m.id === user.id && <span className="text-xs text-ink-3">(you)</span>}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {!!me?.is_demo && (
        <>
          <SectionHeading>Demo data</SectionHeading>
          <Card>
            <p className="text-sm text-ink-2">
              This is a demo account. You can re-generate the sample history or wipe all demo
              accounts and their data.
            </p>
            <div className="mt-3 flex gap-2">
              <form action={reseedDemoDataAction}>
                <Button variant="soft">Re-seed demo data</Button>
              </form>
              <form action={resetDemoDataAction}>
                <Button variant="danger">Delete all demo data</Button>
              </form>
            </div>
          </Card>
        </>
      )}

      <div className="mt-8">
        <form action={logoutAction}>
          <Button variant="ghost"><IconLogout size={15} /> Sign out</Button>
        </form>
      </div>
    </div>
  );
}
