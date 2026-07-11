// Shared domain types for the Personal Growth app.

// ---------- Scripture Library content ----------

export interface LibraryVerse {
  ref: string; // e.g. "Romans 8:1"
  text: string; // KJV text (public domain)
  explanation: string; // 1–2 sentences on what the verse means
  application: string; // one practical sentence
}

export interface LibraryTopic {
  id: string; // slug, e.g. "fear"
  name: string; // "Fear"
  category: string; // one of the seven library categories
  summary: string; // 1–2 sentence introduction
  verses: LibraryVerse[];
  crossRefs: string[]; // additional references, e.g. "Psalm 34:4"
  related: string[]; // related topic ids
}

export interface Situation {
  id: string;
  label: string; // "I feel rejected"
  scriptures: { ref: string; text: string }[]; // KJV
  encouragement: string; // 2–4 sentences
  truths: string[]; // short truth declarations
  reflectionQuestions: string[];
  prayer: string; // a suggested prayer, 2–4 sentences
  worship: string[]; // song titles / themes
  storyIds: string[]; // ids into bibleStories
  topicIds: string[]; // ids into library topics
}

export interface BibleStory {
  id: string;
  title: string; // "David and Goliath"
  reference: string; // "1 Samuel 17"
  topics: string[]; // topic names it speaks to
  summary: string; // 3–5 sentences
  lessons: string[]; // key lessons
  keyScriptures: string[]; // references
  application: string; // personal application, 1–2 sentences
}

export interface Quote {
  text: string;
  author: string;
}

// ---------- Bible reading ----------

export type ChapterActivity = { read?: boolean; listened?: boolean; studied?: boolean; date?: string };
export type BibleProgress = Record<string, ChapterActivity>; // key: "John 3"

export interface BibleNote {
  chapterId: string;
  observations: string;
  lessons: string;
  questions: string;
  application: string;
  prayer: string;
  updatedAt: string;
}

// ---------- Scripture memory (spaced repetition) ----------

export interface MemoryVerse {
  id: string;
  ref: string;
  text: string;
  addedAt: string;
  memorized: boolean;
  lastReviewed?: string;
  nextReview: string; // ISO date
  intervalDays: number;
  lapses: number;
}

// ---------- Prayer journal ----------

export type PrayerKind = "request" | "gratitude" | "daily";

export interface PrayerEntry {
  id: string;
  kind: PrayerKind;
  title: string;
  details: string;
  createdAt: string;
  answered?: boolean;
  answeredAt?: string;
  answerNote?: string;
}

// ---------- Renewing my mind ----------

export type TruthStage = "learning" | "growing" | "established";

export interface TruthEntry {
  id: string;
  lie: string; // negative belief
  truth: string; // God's truth
  verses: string[]; // supporting references
  action: string;
  reflection: string;
  victory: string;
  stage: TruthStage;
  createdAt: string;
  updatedAt: string;
}

// ---------- Library user state ----------

export interface TruthCard {
  id: string;
  ref: string;
  text: string;
  topicId?: string;
  pinnedAt: string;
}

export interface LibraryUserState {
  bookmarks: string[]; // topic ids
  favorites: string[]; // verse refs
  highlights: string[]; // verse refs
  notes: Record<string, string>; // by topic id
}

// ---------- Uploaded teaching documents ----------

export interface TeachingDoc {
  id: string;
  title: string;
  category: string; // theology category
  uploadedAt: string;
  summary: string;
  refs: string[]; // extracted scripture references
  topics: string[]; // detected topics
  notes: string; // study notes
  excerpt: string; // first part of extracted text
}

// ---------- Physical ----------

export interface ExerciseSet {
  reps: number;
  weightKg: number;
}

export interface WorkoutExercise {
  name: string;
  sets: ExerciseSet[];
}

export interface Workout {
  id: string;
  date: string; // ISO date
  focus: string; // e.g. "Glutes & Legs"
  exercises: WorkoutExercise[];
  durationMin?: number;
  notes?: string;
}

export interface Measurement {
  id: string;
  date: string;
  weightKg?: number;
  waistCm?: number;
  hipsCm?: number;
  gluteCm?: number;
  thighCm?: number;
}

export interface ProgressPhoto {
  id: string; // idb key
  date: string;
  caption?: string;
}

// ---------- Meals ----------

export interface DayMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
  waterCups: number; // of 8
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MealWeek {
  weekStart: string; // Monday ISO date
  days: Record<string, DayMeals>; // by ISO date
  shopping: ChecklistItem[];
  prep: ChecklistItem[];
}

export interface FavoriteMeal {
  id: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snacks";
}

// ---------- Habits ----------

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  archived?: boolean;
}

export type HabitLog = Record<string, Record<string, boolean>>; // habitId -> date -> done

// ---------- Goals ----------

export type GoalHorizon = "weekly" | "monthly" | "quarterly" | "yearly" | "longterm";
export type GoalStatus = "not-started" | "in-progress" | "completed" | "on-hold";

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  why: string;
  category: string;
  horizon: GoalHorizon;
  targetDate: string;
  milestones: GoalMilestone[];
  status: GoalStatus;
  reflection: string;
  lessons: string;
  createdAt: string;
}

// ---------- Vision board ----------

export interface VisionItem {
  id: string; // also idb image key
  section: string;
  caption: string;
  order: number;
  createdAt: string;
}

export interface Affirmation {
  id: string;
  text: string;
}

// ---------- Relationships ----------

export type PersonGroup = "Family" | "Friends";

export interface Person {
  id: string;
  name: string;
  group: PersonGroup;
  notes: string; // how I am investing in this relationship
  prayingFor: string;
  lastConnected?: string; // ISO date
  createdAt: string;
}

// ---------- Reflections ----------

export interface DailyReflection {
  date: string;
  wins: string;
  challenges: string;
  gratitude: string;
  lessons: string;
  tomorrowFocus: string;
}

export interface WeeklyReflection {
  weekStart: string;
  achievement: string;
  improve: string;
  spiritual: string;
  physical: string;
  mental: string;
}

export interface MonthlyReflection {
  month: string; // "2026-07"
  goalsReview: string;
  habitsReview: string;
  growth: string;
  wins: string;
}

// ---------- Settings ----------

export interface Reminders {
  bible: boolean;
  workout: boolean;
  meals: boolean;
  weeklyReview: boolean;
  monthlyReview: boolean;
  goals: boolean;
}

export interface AppSettings {
  name: string;
  reminders: Reminders;
  dailyFocus: Record<string, string>; // by ISO date
}
