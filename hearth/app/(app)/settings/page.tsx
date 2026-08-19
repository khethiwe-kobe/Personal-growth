"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useTheme } from "@/components/Shell";
import { logActivity } from "@/lib/data";
import { round2 } from "@/lib/format";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Segmented,
  Tag,
} from "@/components/ui";

export default function SettingsPage() {
  const { sb, user, profile, household, categories, refresh } = useApp();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [hhName, setHhName] = useState("");
  const [rentPer, setRentPer] = useState("");
  const [rentTotal, setRentTotal] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [groceryBudget, setGroceryBudget] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setFullName(profile?.full_name ?? "");
  }, [profile]);

  useEffect(() => {
    if (!household) return;
    setHhName(household.name);
    setRentPer(String(household.rent_per_person));
    setRentTotal(String(household.rent_total));
    setMonthlyBudget(household.monthly_budget != null ? String(household.monthly_budget) : "");
    setGroceryBudget(household.grocery_budget != null ? String(household.grocery_budget) : "");
  }, [household]);

  function flash(text: string) {
    setMsg(text);
    setError("");
    setTimeout(() => setMsg(""), 3500);
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    const { error } = await sb
      .from("profiles")
      .update({ display_name: displayName.trim(), full_name: fullName.trim() })
      .eq("id", user.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    flash("Profile saved.");
  }

  async function saveHousehold() {
    if (!household || !user) return;
    setBusy(true);
    const { error } = await sb
      .from("households")
      .update({
        name: hhName.trim() || household.name,
        rent_per_person: round2(Number(rentPer) || 0),
        rent_total: round2(Number(rentTotal) || 0),
        monthly_budget: monthlyBudget === "" ? null : round2(Number(monthlyBudget) || 0),
        grocery_budget: groceryBudget === "" ? null : round2(Number(groceryBudget) || 0),
      })
      .eq("id", household.id);
    setBusy(false);
    if (error) return setError(error.message);
    await logActivity(sb, household.id, user.id, "edit", "household", household.id, "updated household settings");
    await refresh();
    flash("Household settings saved.");
  }

  async function addCategory() {
    if (!household || !newCategory.trim()) return;
    const { error } = await sb.from("categories").insert({
      household_id: household.id,
      name: newCategory.trim(),
      kind: "expense",
      sort: categories.length + 1,
    });
    if (error) return setError(error.message);
    setNewCategory("");
    await refresh();
    flash("Category added.");
  }

  async function removeCategory(id: string, name: string) {
    if (!household) return;
    if (!window.confirm(`Remove category "${name}"? Existing transactions keep their history but become uncategorised.`)) return;
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) return setError(error.message);
    await refresh();
  }

  return (
    <div>
      <PageHeader title="Settings" description="Profile, household, categories and appearance." />

      {msg ? <p className="mb-4 text-sm text-good">{msg}</p> : null}
      <ErrorNote>{error || null}</ErrorNote>

      <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <div className="space-y-4">
            <Field label="Display name" hint="Shown across the app, e.g. KB.">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Button size="sm" onClick={saveProfile} disabled={busy}>Save profile</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle>Appearance</SectionTitle>
          <Field label="Theme">
            <Segmented
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </Field>
        </Card>

        <Card>
          <SectionTitle>Household</SectionTitle>
          <div className="space-y-4">
            <Field label="Household name">
              <Input value={hhName} onChange={(e) => setHhName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rent per person (R)">
                <Input type="number" min="0" step="0.01" value={rentPer} onChange={(e) => setRentPer(e.target.value)} />
              </Field>
              <Field label="Total rent (R)">
                <Input type="number" min="0" step="0.01" value={rentTotal} onChange={(e) => setRentTotal(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Monthly budget (R)" hint="Optional — used for the remaining-budget figure.">
                <Input type="number" min="0" step="0.01" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} />
              </Field>
              <Field label="Grocery budget (R)" hint="Optional — flags overspending.">
                <Input type="number" min="0" step="0.01" value={groceryBudget} onChange={(e) => setGroceryBudget(e.target.value)} />
              </Field>
            </div>
            <Button size="sm" onClick={saveHousehold} disabled={busy}>Save household</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle>Invite</SectionTitle>
          <p className="text-sm text-muted">
            The second person joins with this code on the sign-up screen:
          </p>
          <p className="mt-2 text-lg font-semibold tracking-widest">{household?.invite_code}</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Categories</SectionTitle>
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm">
                {c.name}
                <Tag>{c.kind}</Tag>
                <button
                  type="button"
                  onClick={() => removeCategory(c.id, c.name)}
                  className="text-muted hover:text-bad"
                  aria-label={`Remove ${c.name}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="flex max-w-sm gap-2">
            <Input
              placeholder="New expense category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <Button size="sm" variant="ghost" onClick={addCategory}>Add</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
