export type Priority = "A" | "B" | "C";

export type TaskRow = {
  id: number;
  user_id: number;
  date: string;
  name: string;
  category_id: number | null;
  priority: Priority;
  planned_minutes: number;
  start_min: number | null;
  end_min: number | null;
  completed: number;
  completed_at: string | null;
  notes: string;
  original_date: string | null;
  focus_room: number;   // done together in a focus room
};

export type FocusRoomRow = {
  id: number;
  group_id: number;
  task_id: number | null;
  opened_by: number;
  title: string;
  date: string;
  created_at: string;
  closed_at: string | null;
};

export type FocusRoomMemberRow = {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: string;
  left_at: string | null;
  last_seen: string;
  present: number;
  away_since: string | null;
  away_count: number;
  present_secs: number;
  tasks_done: number;
  tasks_total: number;
  share_list: number;
  camera_on: number;
  recorded: number;
  /** This member's own task for the sitting — private to them. */
  task_id: number | null;
};

export type RoomMessageRow = {
  id: number;
  room_id: number;
  user_id: number;
  body: string;
  kind: string;
  created_at: string;
};

export type CategoryRow = {
  id: number;
  user_id: number;
  name: string;
  color: string;
  kind: "task" | "goal" | "both";
  position: number;
  archived: number;
  focus_room: number;
};

export type TimeBlockRow = {
  id: number;
  user_id: number;
  date: string;
  start_min: number;
  end_min: number;
  kind: string;
  label: string;
  note: string;   // private — never leaves the owner's own views
};

export type GoalRow = {
  id: number;
  user_id: number;
  category_id: number | null;
  title: string;
  why: string;
  measurement: string;
  tracking_type:
    | "number" | "percent" | "boolean" | "time"
    | "frequency" | "streak" | "quantity" | "custom";
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  period_target: number;
  minimum_target: number;
  overall_target: number | null;
  daily_action: string;
  evidence: string;
  start_date: string;
  deadline: string | null;
  active_days: string;
  status: "active" | "paused" | "completed" | "archived";
  paused_at: string | null;
  pauses_json: string;
  completed_at: string | null;
  share_progress: number;
};

export type CheckinRow = {
  id: number;
  goal_id: number;
  user_id: number;
  date: string;
  value: number;
  note: string;
};

export type FocusSessionRow = {
  id: number;
  user_id: number;
  date: string;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  focus_seconds: number;
  status: "active" | "completed" | "interrupted" | "abandoned";
  interrupt_reason: string | null;
  interrupt_note: string;
  label: string;
  config_json: string;
  last_heartbeat: string | null;
};

export type EventRow = {
  id: number;
  user_id: number;
  title: string;
  date: string;
  end_date: string | null;
  start_min: number | null;
  end_min: number | null;
  category: string;
  color: string;
  notes: string;
  reminder_minutes: number | null;
  countdown_slot: number | null;
};

export type TimetableEntryRow = {
  id: number;
  user_id: number;
  day_of_week: number;
  start_min: number;
  end_min: number;
  title: string;
  location: string;
  color: string;
  source: "manual" | "import";
};
