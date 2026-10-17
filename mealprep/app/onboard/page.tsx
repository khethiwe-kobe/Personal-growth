import { getSessionUser } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import OnboardingWizard from "@/components/OnboardingWizard";
import Link from "next/link";

export default async function Onboard() {
  const user = await getSessionUser();
  const isStaff = !!user && user.role !== "client";
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/70"><div className="font-display text-lg">{getSetting("brand_name")}</div><Link href={isStaff ? "/clients" : "/login"} className="text-sm text-ink-2">{isStaff ? "Back to clients" : "Sign in"}</Link></header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6"><div className="kicker">Client onboarding</div><h1 className="text-3xl">{isStaff ? "Onboard a client" : "Let's build your nutrition profile"}</h1><p className="text-sm text-ink-2 mt-1">Ten short steps. Your answers generate a nutrition summary and preliminary meal recommendations. Health information is stored as special personal information and only used for your meal planning.</p></div>
        <OnboardingWizard isStaff={isStaff} consentVersion={getSetting("consent_version")} brand={getSetting("brand_name")} />
      </main>
    </div>
  );
}
