import { requireUser, PERMISSIONS } from "@/lib/auth";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDb, getSetting } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "client") redirect("/portal");
  const n = (getDb().prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(user.id) as { n: number }).n;
  return <Shell user={user} perms={PERMISSIONS[user.role]} brand={getSetting("brand_name")} notifications={n}>{children}</Shell>;
}
