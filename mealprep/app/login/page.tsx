import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSetting } from "@/lib/db";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(user.role === "client" ? "/portal" : "/dashboard");
  const { error } = await searchParams;
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-ink text-bone">
        <div className="font-display text-2xl">{getSetting("brand_name")}</div>
        <div>
          <div className="font-display text-5xl leading-tight max-w-md">{getSetting("tagline")}</div>
          <p className="mt-6 text-bone/70 max-w-md text-sm">Client data → nutrition analysis → personalised plans → recipes → grocery → inventory → production → packaging → delivery → feedback → retention → revenue → intelligence. One connected system.</p>
        </div>
        <div className="text-xs text-bone/50">MealPrep OS</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form action={login} className="w-full max-w-sm space-y-4">
          <h1 className="text-3xl">Sign in</h1>
          <p className="text-sm text-ink-2">Staff and clients use the same sign-in. Clients land in their portal.</p>
          {error && <div className="text-sm text-critical">{error}</div>}
          <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
          <label className="block"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
          <button className="btn-primary w-full">Sign in</button>
          <div className="text-xs text-ink-3 leading-relaxed">
            Demo: <code>owner@demo.local</code> / <code>admin-demo</code> · planner, kitchen, packaging, driver, accounts @demo.local with <code>&lt;role&gt;-demo</code> · client <code>thandiwe@client.local</code> / <code>client-demo</code>
          </div>
          <a href="/onboard" className="btn-secondary w-full">New client? Start your assessment</a>
        </form>
      </div>
    </div>
  );
}
