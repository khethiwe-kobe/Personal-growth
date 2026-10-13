import type Anthropic from "@anthropic-ai/sdk";

export type Phase = "assessment" | "analysis" | "programme" | "training";

export const PHASES: { id: Phase; label: string; blurb: string }[] = [
  { id: "assessment", label: "Assessment", blurb: "The coach is learning about you." },
  { id: "analysis", label: "Analysis", blurb: "Strengths, weaknesses and priorities." },
  { id: "programme", label: "Programme", blurb: "Your plan is being built." },
  { id: "training", label: "Training", blurb: "Daily sessions and progress tracking." },
];

/** Free-form intake record. Known keys are rendered with labels; anything else is shown as-is. */
export type Profile = Record<string, string | number | boolean | null>;

export const PROFILE_LABELS: Record<string, string> = {
  age: "Age",
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  training_days_per_week: "Training days per week",
  session_minutes: "Minutes per session",
  equipment: "Equipment",
  gym_access: "Gym access",
  experience: "Training experience",
  current_routine: "Current routine",
  strength_levels: "Current strength",
  bodyweight_levels: "Bodyweight numbers",
  cardio: "Cardiovascular fitness",
  injuries: "Injuries and restrictions",
  sleep: "Sleep and recovery",
  nutrition: "Nutrition and protein",
  weaknesses: "Biggest weaknesses",
  weeks_until_rd: "Weeks until RD",
  rd_date: "RD date",
  rd_challenges: "Expected RD challenges",
  notes: "Other notes",
};

export type Metric = {
  id: string;
  key: string; // e.g. pull_ups, push_ups, dead_hang_s
  label: string;
  value: number;
  unit: string;
  date: string; // YYYY-MM-DD
  note?: string;
};

export type ProgrammeBlock = { name: string; weeks: string; focus: string; notes?: string };
export type ProgrammeDay = { day: string; session: string; focus: string; duration_min: number };
export type Programme = {
  title: string;
  summary: string;
  start_date?: string;
  total_weeks?: number;
  blocks: ProgrammeBlock[];
  schedule: ProgrammeDay[];
  principles: string[];
  updated_at: string;
};

export type LoggedExercise = {
  name: string;
  sets?: number;
  reps?: string;
  load?: string;
  notes?: string;
};

export type WorkoutLog = {
  id: string;
  date: string;
  session: string;
  completed: boolean;
  exercises: LoggedExercise[];
  felt_easy?: string;
  felt_hard?: string;
  pain?: string;
  coach_notes?: string;
};

export type Settings = {
  apiKey: string;
};

export type CoachState = {
  version: 1;
  phase: Phase;
  profile: Profile;
  programme: Programme | null;
  logs: WorkoutLog[];
  metrics: Metric[];
  /** Full API-shaped transcript; thinking and tool blocks are kept verbatim. */
  history: Anthropic.MessageParam[];
  /** Bumped when the user edits tracked data by hand, so the coach is told. */
  stateVersion: number;
  lastSnapshotVersion: number;
  settings: Settings;
  createdAt: string;
};

export const EMPTY_STATE: CoachState = {
  version: 1,
  phase: "assessment",
  profile: {},
  programme: null,
  logs: [],
  metrics: [],
  history: [],
  stateVersion: 0,
  lastSnapshotVersion: 0,
  settings: { apiKey: "" },
  createdAt: new Date(0).toISOString(),
};

/** Marker for context blocks the UI hides and the coach reads. */
export const CONTEXT_PREFIX = "<context>";

/** Events streamed from /api/coach. */
export type CoachEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "assistant"; content: Anthropic.MessageParam["content"] }
  | { type: "tool_results"; content: Anthropic.MessageParam["content"] }
  | { type: "done"; stop: string }
  | { type: "error"; message: string };
