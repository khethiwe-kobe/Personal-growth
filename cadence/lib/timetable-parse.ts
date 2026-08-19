/**
 * Heuristic timetable text parser. A web app can't run reliable OCR offline,
 * so the flow is: upload image/PDF for reference → paste or type the text →
 * we parse lines like "Monday 08:00-10:00 Lecture (Lab 2)" into structured
 * entries the user reviews before saving. Honest, editable, no magic claimed.
 */

export type ParsedEntry = {
  day_of_week: number; // 0=Mon
  start_min: number;
  end_min: number;
  title: string;
  location: string;
};

const DAYS: Record<string, number> = {
  monday: 0, mon: 0, tuesday: 1, tue: 1, tues: 1, wednesday: 2, wed: 2,
  thursday: 3, thu: 3, thur: 3, thurs: 3, friday: 4, fri: 4,
  saturday: 5, sat: 5, sunday: 6, sun: 6,
};

const TIME_RANGE =
  /(\d{1,2})[:h.](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[:h.](\d{2})/i;

export function parseTimetableText(text: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  let currentDay: number | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Day heading anywhere on the line?
    const dayMatch = line.toLowerCase().match(/^([a-z]+)\b/);
    let lineDay: number | null = null;
    if (dayMatch && DAYS[dayMatch[1]] !== undefined) {
      lineDay = DAYS[dayMatch[1]];
    }

    const tm = line.match(TIME_RANGE);
    if (!tm) {
      if (lineDay !== null) currentDay = lineDay; // pure day heading
      continue;
    }

    const day = lineDay ?? currentDay;
    if (day === null) continue;
    if (lineDay !== null) currentDay = lineDay;

    const start = Number(tm[1]) * 60 + Number(tm[2]);
    const end = Number(tm[3]) * 60 + Number(tm[4]);
    if (end <= start || start < 0 || end > 24 * 60) continue;

    // Title = what's left after removing day + time range.
    let rest = line.replace(TIME_RANGE, " ");
    if (lineDay !== null) rest = rest.replace(/^[A-Za-z]+\b/, " ");
    rest = rest.replace(/^[\s—–\-:•·]+|[\s—–\-:•·]+$/g, "").trim();

    let title = rest, location = "";
    const loc = rest.match(/^(.*?)\s*[\(\[]([^)\]]+)[\)\]]\s*$/);
    if (loc) { title = loc[1].trim(); location = loc[2].trim(); }
    if (!title) title = "Class";

    out.push({ day_of_week: day, start_min: start, end_min: end, title, location });
  }
  return out;
}
