import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";

/**
 * The coach's tools write to the athlete's tracked data. The server validates
 * each call and answers "Saved"; the browser applies the same input to its
 * local store (see lib/coach/apply.ts), so nothing is persisted server-side.
 */

export const UpdateProfileInput = z.object({
  fields: z.array(z.object({ key: z.string().min(1), value: z.string() })),
});

export const RecordMetricInput = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export const SaveProgrammeInput = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  start_date: z.string().optional(),
  total_weeks: z.number().int().positive().optional(),
  blocks: z.array(
    z.object({
      name: z.string(),
      weeks: z.string(),
      focus: z.string(),
      notes: z.string().optional(),
    }),
  ),
  schedule: z.array(
    z.object({
      day: z.string(),
      session: z.string(),
      focus: z.string(),
      duration_min: z.number().int().positive(),
    }),
  ),
  principles: z.array(z.string()),
});

export const LogWorkoutInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.string().min(1),
  completed: z.boolean(),
  exercises: z.array(
    z.object({
      name: z.string(),
      sets: z.number().int().optional(),
      reps: z.string().optional(),
      load: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  felt_easy: z.string().optional(),
  felt_hard: z.string().optional(),
  pain: z.string().optional(),
  coach_notes: z.string().optional(),
});

export const SetPhaseInput = z.object({
  phase: z.enum(["assessment", "analysis", "programme", "training"]),
});

export const TOOL_SCHEMAS = {
  update_profile: UpdateProfileInput,
  record_metric: RecordMetricInput,
  save_programme: SaveProgrammeInput,
  log_workout: LogWorkoutInput,
  set_phase: SetPhaseInput,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export function isToolName(name: string): name is ToolName {
  return name in TOOL_SCHEMAS;
}

/** Deterministic order matters for prompt caching: never reorder. */
export const COACH_TOOLS: FunctionDeclaration[] = [
  {
    name: "update_profile",
    description:
      "Save or update facts about the athlete gathered during assessment (age, height_cm, weight_kg, training_days_per_week, session_minutes, equipment, gym_access, experience, current_routine, strength_levels, bodyweight_levels, cardio, injuries, sleep, nutrition, weaknesses, weeks_until_rd, rd_date, rd_challenges, notes). Use the snake_case keys listed where they fit; add new snake_case keys for anything else. Only include fields you learned or that changed.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          description: "One entry per fact: the snake_case key and its value as text.",
          items: {
            type: "object",
            properties: { key: { type: "string" }, value: { type: "string" } },
            required: ["key", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["fields"],
      additionalProperties: false,
    },
  },
  {
    name: "record_metric",
    description:
      "Record a measurable performance number: a baseline test, a reassessment, or a notable training result. Use a stable snake_case key per test so progress can be charted (for example pull_ups, push_ups, dead_hang_s, run_1_5_mile_s, squat_1rm_kg, farmer_carry_m, plank_s). Always use the same key, label and unit for the same test.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        label: { type: "string", description: "Human label, e.g. 'Max strict pull-ups'." },
        value: { type: "number" },
        unit: { type: "string", description: "reps, kg, s, m, km, min, level, etc." },
        date: { type: "string", description: "YYYY-MM-DD" },
        note: { type: "string" },
      },
      required: ["key", "label", "value", "unit", "date"],
      additionalProperties: false,
    },
  },
  {
    name: "save_programme",
    description:
      "Save the athlete's full training programme (replaces any previous version). Call this when you first build the programme and whenever you restructure it (new block, changed weekly schedule, taper). The schedule lists one entry per training day of the week; the blocks describe periodisation across the weeks before RD.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string", description: "A few sentences on structure and rationale." },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        total_weeks: { type: "integer" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              weeks: { type: "string", description: "e.g. '1-4'" },
              focus: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name", "weeks", "focus"],
            additionalProperties: false,
          },
        },
        schedule: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "string", description: "Monday … Sunday" },
              session: { type: "string", description: "Short session name, or 'Rest'." },
              focus: { type: "string" },
              duration_min: { type: "integer" },
            },
            required: ["day", "session", "focus", "duration_min"],
            additionalProperties: false,
          },
        },
        principles: { type: "array", items: { type: "string" } },
      },
      required: ["title", "summary", "blocks", "schedule", "principles"],
      additionalProperties: false,
    },
  },
  {
    name: "log_workout",
    description:
      "Log a completed (or partially completed) workout after the athlete reports back: the exercises with sets, reps and loads actually performed, what felt easy or hard, any pain, and your short coaching note for next time. Log one entry per session.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        session: { type: "string" },
        completed: { type: "boolean", description: "True if all prescribed sets were done." },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              sets: { type: "integer" },
              reps: { type: "string", description: "e.g. '8,8,7' or '5x5'" },
              load: { type: "string", description: "e.g. '60 kg', 'bodyweight', '+10 kg'" },
              notes: { type: "string" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
        felt_easy: { type: "string" },
        felt_hard: { type: "string" },
        pain: { type: "string" },
        coach_notes: { type: "string" },
      },
      required: ["date", "session", "completed", "exercises"],
      additionalProperties: false,
    },
  },
  {
    name: "set_phase",
    description:
      "Move the coaching relationship to its next phase: assessment (interviewing), analysis (strengths and weaknesses delivered), programme (the plan has been saved), training (daily coaching and progress tracking).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        phase: { type: "string", enum: ["assessment", "analysis", "programme", "training"] },
      },
      required: ["phase"],
      additionalProperties: false,
    },
  },
];
