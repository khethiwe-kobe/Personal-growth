import type { BibleStory, LibraryTopic } from "./types";
import { libraryTopics1 } from "./data/library-1";
import { libraryTopics2 } from "./data/library-2";
import { bibleStories } from "./data/stories";

export const LIBRARY_CATEGORIES = [
  "Identity in Christ",
  "Emotions",
  "Spiritual Growth",
  "Character",
  "Relationships",
  "Daily Living",
  "Difficult Seasons",
] as const;

export const allTopics: LibraryTopic[] = [...libraryTopics1, ...libraryTopics2];

const topicById = new Map(allTopics.map((t) => [t.id, t]));

export function getTopic(id: string): LibraryTopic | undefined {
  return topicById.get(id);
}

export function topicsInCategory(category: string): LibraryTopic[] {
  return allTopics.filter((t) => t.category === category);
}

// People of the Bible → the stories and topics where they appear, for search.
const PEOPLE: Record<string, string[]> = {
  david: ["david-and-goliath", "david-in-adullam"],
  goliath: ["david-and-goliath"],
  gideon: ["gideon"],
  abraham: ["abraham-waiting-for-isaac"],
  isaac: ["abraham-waiting-for-isaac"],
  joseph: ["joseph"],
  hannah: ["hannah"],
  peter: ["peter-walks-on-water"],
  moses: ["moses-called"],
  esther: ["esther"],
  jeremiah: ["jeremiah-called"],
  paul: ["paul-conversion"],
  job: ["job"],
  ruth: ["ruth-and-naomi"],
  naomi: ["ruth-and-naomi"],
  elijah: ["elijah-at-horeb"],
  daniel: ["daniel-in-the-lions-den"],
  lazarus: ["lazarus-raised"],
  jesus: ["jesus-rejected-at-nazareth", "jesus-in-gethsemane", "the-storm-calmed"],
  shadrach: ["shadrach-meshach-abednego"],
};

export interface SearchResults {
  topics: LibraryTopic[];
  stories: BibleStory[];
  verses: { topic: LibraryTopic; ref: string; text: string }[];
}

export function searchLibrary(query: string): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { topics: [], stories: [], verses: [] };

  const topics = allTopics.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  );

  const verses: SearchResults["verses"] = [];
  for (const t of allTopics) {
    for (const v of t.verses) {
      if (v.ref.toLowerCase().includes(q) || v.text.toLowerCase().includes(q)) {
        verses.push({ topic: t, ref: v.ref, text: v.text });
      }
    }
  }

  const storyIds = new Set<string>();
  for (const [person, ids] of Object.entries(PEOPLE)) {
    if (person.includes(q) || q.includes(person)) ids.forEach((id) => storyIds.add(id));
  }
  const stories = bibleStories.filter(
    (s) =>
      storyIds.has(s.id) ||
      s.title.toLowerCase().includes(q) ||
      s.reference.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.topics.some((t) => t.toLowerCase().includes(q))
  );

  return { topics: topics.slice(0, 20), stories: stories.slice(0, 12), verses: verses.slice(0, 30) };
}

export function storiesForTopic(topicName: string): BibleStory[] {
  const n = topicName.toLowerCase();
  return bibleStories.filter((s) => s.topics.some((t) => t.toLowerCase() === n));
}
