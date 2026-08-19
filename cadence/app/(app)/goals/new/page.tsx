import { requireUser } from "@/lib/auth";
import { categoriesFor } from "@/lib/repo";
import GoalWizard from "@/components/GoalWizard";

export const metadata = { title: "New goal" };
export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const user = await requireUser();
  const categories = await categoriesFor(user.id);
  return (
    <div className="fade-up py-4">
      <GoalWizard categories={categories} />
    </div>
  );
}
