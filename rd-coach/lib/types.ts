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

/** One part of a turn, in the shape the Gemini API uses (kept verbatim, including thought signatures). */
export type ChatPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name?: string; response?: Record<string, unknown> };
};

export type ChatContent = { role: "user" | "model"; parts: ChatPart[] };

export type CoachState = {
  version: 1;
  phase: Phase;
  profile: Profile;
  programme: Programme | null;
  logs: WorkoutLog[];
  metrics: Metric[];
  /** Full transcript; model turns are stored exactly as the API returned them. */
  history: ChatContent[];
  /** Coach-written summary waiting to be passed along with the next message. */
  pendingSummary?: string;
  /** Bumped when the user edits tracked data by hand, so the coach is told. */
  stateVersion: number;
  lastSnapshotVersion: number;
  createdAt: string;
};

/** The part of a member's state the whole group can see. */
export type PublicProgress = Pick<CoachState, "programme" | "logs" | "metrics">;

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
  createdAt: new Date(0).toISOString(),
};

/** Marker for context blocks the UI hides and the coach reads. */
export const CONTEXT_PREFIX = "<context>";

/** Events streamed from /api/coach. */
export type CoachEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "model"; parts: ChatPart[] }
  | { type: "tool_responses"; parts: ChatPart[] }
  | { type: "status"; text: string }
  | { type: "reset" }
  | { type: "busy"; message: string }
  | { type: "done"; stop: string }
  | { type: "error"; message: string };

export type Member = { id: string; username: string; name: string; isAdmin: boolean };

export const REACTIONS = [
  { id: "strong", label: "Strong" },
  { id: "respect", label: "Respect" },
  { id: "keep_going", label: "Keep going" },
  { id: "inspiring", label: "Inspiring" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["id"];

export type PostKind = "session" | "baseline" | "best" | "programme" | "week_goal" | "photo";

export type PostDraft = { kind: PostKind; day: string; data: Record<string, unknown> };

export type FeedComment = { id: string; memberId: string; name: string; body: string; createdAt: string };

export type FeedPost = {
  id: string;
  memberId: string;
  name: string;
  kind: PostKind;
  day: string;
  data: Record<string, unknown>;
  photoId: string | null;
  createdAt: string;
  reactions: Record<string, number>;
  mine: string[];
  comments: FeedComment[];
};
