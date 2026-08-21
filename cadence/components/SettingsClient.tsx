"use client";

import { useActionState, useTransition, useState } from "react";
import {
  updateProfileAction, changePasswordAction, updateAppearanceAction,
  createCategoryAction, updateCategoryAction, deleteCategoryAction,
} from "@/app/actions";
import type { CategoryRow } from "@/lib/types";
import { Button } from "./ui";
import { IconSun, IconMoon, IconSettings } from "./icons";

export function ProfileForm({
  user,
}: {
  user: { display_name: string; bio: string; email: string | null; timezone: string; role: string };
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction, null as { error?: string; ok?: boolean } | null
  );
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Name</span>
        <input name="display_name" defaultValue={user.display_name} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Email (optional)</span>
        <input name="email" type="email" defaultValue={user.email ?? ""} />
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Short bio</span>
        <input name="bio" defaultValue={user.bio} maxLength={400}
          placeholder="A line about who you're becoming" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Timezone (IANA)</span>
        <input name="timezone" defaultValue={user.timezone} placeholder="Africa/Johannesburg" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">I am…</span>
        <select name="role" defaultValue={user.role}>
          <option value="student">A student</option>
          <option value="working">Working</option>
        </select>
      </label>
      {state?.error && <p className="col-span-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && <p className="col-span-2 text-xs text-ok">Profile saved.</p>}
      <div className="col-span-2">
        <Button disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}

export function AppearancePicker({ current }: { current: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);
  const pick = (v: "light" | "dark" | "system") => {
    setValue(v);
    const resolved = v === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : v;
    document.documentElement.dataset.theme = resolved;
    start(() => updateAppearanceAction(v));
  };
  const opts = [
    { v: "light" as const, label: "Light", icon: <IconSun size={15} /> },
    { v: "dark" as const, label: "Dark", icon: <IconMoon size={15} /> },
    { v: "system" as const, label: "System", icon: <IconSettings size={15} /> },
  ];
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Appearance">
      {opts.map((o) => (
        <button key={o.v} type="button" disabled={pending}
          onClick={() => pick(o.v)}
          role="radio" aria-checked={value === o.v}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium ${
            value === o.v
              ? "border-accent bg-accent-soft text-accent-ink"
              : "border-line text-ink-2 hover:bg-surface-2"
          }`}>
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction, null as { error?: string; ok?: boolean } | null
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">New password (min 8)</span>
        <input name="next" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {state?.error && <p className="text-xs text-danger sm:col-span-2">{state.error}</p>}
      {state?.ok && <p className="text-xs text-ok sm:col-span-2">Password changed.</p>}
      <div className="sm:col-span-2">
        <Button disabled={pending}>Change password</Button>
      </div>
    </form>
  );
}

const PASTELS = ["#b7c4d6", "#cbb9d9", "#a8c5b4", "#d9b8c4", "#d9c9a8", "#d6bcb4", "#c4c4bc", "#a9c6c9"];

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <form key={c.id} action={updateCategoryAction}
          className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
          <input type="hidden" name="id" value={c.id} />
          <input name="color" type="color" defaultValue={c.color} aria-label={`${c.name} colour`} />
          <input name="name" defaultValue={c.name} className="flex-1" aria-label="Category name" />
          <Button variant="ghost" className="!py-1.5">Save</Button>
          <label className="flex items-center gap-1 text-[11px] text-ink-2" title="Tasks in this category are done together in a focus room, and can only be completed by joining it">
            <input type="checkbox" name="focus_room" defaultChecked={c.focus_room === 1} />
            focus room
          </label>
          <Button variant="danger" className="!py-1.5" formAction={deleteCategoryAction}>Remove</Button>
        </form>
      ))}
      <form action={createCategoryAction} className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 p-2">
        <input name="color" type="color"
          defaultValue={PASTELS[categories.length % PASTELS.length]} aria-label="New category colour" />
        <input name="name" placeholder="New category…" className="flex-1" required />
        <Button variant="soft" className="!py-1.5">Add</Button>
      </form>
      <p className="text-[11px] text-ink-3">
        Removing a category archives it — your historic analytics keep their labels.
      </p>
    </div>
  );
}
