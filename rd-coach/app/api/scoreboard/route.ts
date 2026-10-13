import { json, withMember } from "@/lib/server/http";
import { photoDays } from "@/lib/server/social";
import { allPublicProgress } from "@/lib/server/state";
import { POINTS, scoreboard } from "@/lib/scoring";
import { dayOf } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withMember(req, async () => {
    const [members, photos] = await Promise.all([allPublicProgress(), photoDays()]);
    const today = dayOf();
    const progress = members.map((m) => ({ id: m.id, name: m.name, ...m.progress, photoDays: photos.get(m.id) ?? [] }));
    return json({ today, points: POINTS, week: scoreboard(progress, "week", today), all: scoreboard(progress, "all", today) });
  });
}
