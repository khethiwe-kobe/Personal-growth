"use server";
import { redirect } from "next/navigation";
import { createClientFromOnboarding, type OnboardingData } from "@/lib/repo/clients";
import { getSetting } from "@/lib/db";
import { getSessionUser, createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function submitOnboarding(payload: OnboardingData): Promise<{ ok: true; client_id: number } | { ok: false; error: string }> {
  try {
    if (!payload.first_name || !payload.last_name || !payload.email) return { ok: false, error: "Name and email are required." };
    if (!payload.consents.data_processing || !payload.consents.health_data || !payload.consents.terms) return { ok: false, error: "Required consents were not given." };
    const staff = await getSessionUser();
    const id = createClientFromOnboarding({ ...payload, consent_version: getSetting("consent_version"), created_by: staff && staff.role !== "client" ? staff.id : null });
    if (!staff && payload.password) {
      const u = getDb().prepare("SELECT user_id FROM clients WHERE id = ?").get(id) as { user_id: number | null };
      if (u.user_id) await createSession(u.user_id);
    }
    return { ok: true, client_id: id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function afterOnboarding(clientId: number, isStaff: boolean) {
  redirect(isStaff ? `/clients/${clientId}?tab=nutrition` : "/portal");
}
