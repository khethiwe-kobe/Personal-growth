// Scripture-reference extraction and topic detection for uploaded teachings.

import { ALL_BOOKS } from "./bible";

const BOOK_ALIASES: Record<string, string> = {
  "Psalm": "Psalms",
  "Song of Songs": "Song of Solomon",
  "Canticles": "Song of Solomon",
};

const NAME_TO_BOOK = new Map<string, string>();
for (const b of ALL_BOOKS) NAME_TO_BOOK.set(b.name.toLowerCase(), b.name);
for (const [alias, canonical] of Object.entries(BOOK_ALIASES)) NAME_TO_BOOK.set(alias.toLowerCase(), canonical);

const bookPattern = [...NAME_TO_BOOK.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const REF_RE = new RegExp(
  `\\b(${bookPattern})\\s+(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)*))?`,
  "gi"
);

/** Extract normalized scripture references ("Romans 8:28-30") from free text. */
export function extractRefs(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const book = NAME_TO_BOOK.get(m[1].toLowerCase());
    if (!book) continue;
    const verses = m[3] ? `:${m[3].replace(/\s+/g, "").replace(/–/g, "-")}` : "";
    const ref = `${book} ${m[2]}${verses}`;
    if (!seen.has(ref)) {
      seen.add(ref);
      out.push(ref);
    }
  }
  return out;
}

export const THEOLOGY_CATEGORIES = [
  "Salvation", "Grace", "Faith", "Prayer", "The Church", "The Holy Spirit", "Healing",
  "Communion", "Repentance", "Water Baptism", "Baptism in the Holy Spirit",
  "Baptism of Suffering", "Leadership", "Discipleship", "Evangelism", "End Times",
  "Holiness", "Sanctification", "General",
] as const;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Salvation": ["salvation", "saved", "born again", "eternal life", "redemption", "justif"],
  "Grace": ["grace", "unmerited", "favour", "favor"],
  "Faith": ["faith", "believe", "believing", "trust in god"],
  "Prayer": ["prayer", "praying", "intercession", "petition", "supplication"],
  "The Church": ["church", "body of christ", "congregation", "fellowship", "assembly"],
  "The Holy Spirit": ["holy spirit", "holy ghost", "comforter", "spirit of god", "gifts of the spirit"],
  "Healing": ["healing", "healed", "sickness", "disease", "restore health"],
  "Communion": ["communion", "lord's supper", "breaking of bread", "cup of the lord"],
  "Repentance": ["repent", "repentance", "turn from sin", "contrite"],
  "Water Baptism": ["water baptism", "baptized in water", "baptism of repentance", "baptise"],
  "Baptism in the Holy Spirit": ["baptism in the holy spirit", "baptized with the holy", "filled with the spirit", "tongues"],
  "Baptism of Suffering": ["baptism of suffering", "suffering", "affliction", "persecution", "trial", "fiery"],
  "Leadership": ["leader", "leadership", "elder", "shepherd", "oversee"],
  "Discipleship": ["disciple", "discipleship", "follow me", "deny himself", "take up his cross"],
  "Evangelism": ["evangelism", "gospel", "witness", "preach", "great commission", "soul winning"],
  "End Times": ["end times", "last days", "second coming", "rapture", "tribulation", "antichrist", "millennium"],
  "Holiness": ["holiness", "holy living", "set apart", "consecrat"],
  "Sanctification": ["sanctif", "purif", "transform", "conform to the image"],
};

/** Score the text against theology categories; returns the best match and all hits. */
export function detectCategories(text: string): { best: string; all: string[] } {
  const lower = text.toLowerCase();
  const scores: [string, number][] = [];
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      score += (lower.match(re) || []).length;
    }
    if (score > 0) scores.push([cat, score]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return {
    best: scores[0]?.[0] ?? "General",
    all: scores.slice(0, 4).map(([c]) => c),
  };
}

/** A crude extractive summary: the first few substantial sentences. */
export function summarize(text: string, maxSentences = 3): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 40 && s.length < 400);
  return sentences.slice(0, maxSentences).join(" ");
}
