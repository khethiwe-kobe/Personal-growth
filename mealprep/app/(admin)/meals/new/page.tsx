import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import MealForm from "@/components/MealForm";
import { saveMeal } from "@/app/actions";

export default async function NewMeal() {
  await requirePermission("meals:edit");
  return <div><PageHeader kicker="Meal database" title="New meal">Save the meal first, then add its recipe on the Recipe tab. Nutrition and cost are computed from the recipe.</PageHeader><Card><MealForm action={saveMeal} /></Card></div>;
}
