"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Modal, PageTitle, SectionTitle, Select, Stat, Tabs, Tag, Textarea } from "@/components/ui";
import { BarChart, LineChart } from "@/components/viz";
import { useStore } from "@/lib/storage";
import type { Measurement, ProgressPhoto, Workout, WorkoutExercise } from "@/lib/types";
import { addDays, formatShort, lastNDays, todayISO, uid, weekStart } from "@/lib/dates";
import { deleteImage, getImage, putImage } from "@/lib/idb";

const EXERCISE_LIBRARY: { name: string; target: string; cue: string }[] = [
  { name: "Barbell hip thrust", target: "Glutes", cue: "Chin tucked, full lockout, squeeze two seconds at the top." },
  { name: "Romanian deadlift", target: "Glutes & hamstrings", cue: "Hips back, soft knees, bar close to the legs." },
  { name: "Bulgarian split squat", target: "Glutes & quads", cue: "Long stance for glutes; lean the torso slightly forward." },
  { name: "Back squat", target: "Legs", cue: "Sit between the hips, drive the floor away." },
  { name: "Walking lunge", target: "Glutes & legs", cue: "Step long, push through the front heel." },
  { name: "Glute bridge", target: "Glutes", cue: "Ribs down, posterior tilt at the top." },
  { name: "Cable kickback", target: "Glutes", cue: "Slight torso lean, move only at the hip." },
  { name: "Hip abduction", target: "Glute medius", cue: "Lean forward slightly, pause at the widest point." },
  { name: "Leg press", target: "Quads & glutes", cue: "Feet high and wide for more glute." },
  { name: "Deadlift", target: "Posterior chain", cue: "Brace hard, push the floor, hips and chest rise together." },
  { name: "Goblet squat", target: "Legs", cue: "Elbows inside the knees, stay tall." },
  { name: "Step-up", target: "Glutes & quads", cue: "Drive from the top leg; do not push off the floor." },
  { name: "Leg curl", target: "Hamstrings", cue: "Control the lowering for three seconds." },
  { name: "Calf raise", target: "Calves", cue: "Full stretch at the bottom, pause at the top." },
  { name: "Hyperextension", target: "Glutes & lower back", cue: "Round the upper back slightly to bias the glutes." },
  { name: "Sumo squat", target: "Glutes & inner thigh", cue: "Wide stance, toes out, knees track over toes." },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkoutsPage() {
  const [tab, setTab] = useState("log");
  const [workouts, setWorkouts] = useStore<Workout[]>("workouts", []);

  const today = todayISO();
  const ws = weekStart(today);
  const thisWeek = workouts.filter((w) => w.date >= ws && w.date <= today).length;

  const weekStreak = useMemo(() => {
    let n = 0;
    let cursor = addDays(ws, -7);
    while (n < 520) {
      const count = workouts.filter((w) => w.date >= cursor && w.date < addDays(cursor, 7)).length;
      if (count >= 4) {
        n++;
        cursor = addDays(cursor, -7);
      } else break;
    }
    return n + (thisWeek >= 4 ? 1 : 0);
  }, [workouts, ws, thisWeek]);

  const monthCount = workouts.filter((w) => w.date.startsWith(today.slice(0, 7))).length;

  // Personal records: heaviest weight per exercise
  const prs = useMemo(() => {
    const best = new Map<string, { weightKg: number; reps: number; date: string }>();
    for (const w of workouts)
      for (const ex of w.exercises)
        for (const s of ex.sets) {
          const cur = best.get(ex.name);
          if (!cur || s.weightKg > cur.weightKg) best.set(ex.name, { weightKg: s.weightKg, reps: s.reps, date: w.date });
        }
    return [...best.entries()].sort((a, b) => b[1].weightKg - a[1].weightKg);
  }, [workouts]);

  const weeklyBars = useMemo(() => {
    const out: { label: string; value: number; hint?: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(ws, -7 * i);
      const count = workouts.filter((w) => w.date >= start && w.date < addDays(start, 7)).length;
      out.push({ label: formatShort(start), value: count, hint: "workouts" });
    }
    return out;
  }, [workouts, ws]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Workouts"
        subtitle="At least four sessions a week, building muscle with a focus on glutes and legs. Show up; the results will follow."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This week" value={`${thisWeek} / 4`} hint={thisWeek >= 4 ? "goal met" : `${4 - thisWeek} to go`} />
        <Stat label="Weekly streak" value={`${weekStreak}w`} hint="weeks at 4+" />
        <Stat label="This month" value={monthCount} hint="sessions" />
        <Stat label="All time" value={workouts.length} hint="sessions logged" />
      </div>

      <div className="mt-8">
        <Tabs
          tabs={[
            { id: "log", label: "Log & history" },
            { id: "plan", label: "Weekly plan" },
            { id: "body", label: "Measurements" },
            { id: "photos", label: "Progress photos" },
            { id: "library", label: "Exercise library" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "log" && <LogTab workouts={workouts} setWorkouts={setWorkouts} weeklyBars={weeklyBars} prs={prs} />}
      {tab === "plan" && <PlanTab />}
      {tab === "body" && <BodyTab />}
      {tab === "photos" && <PhotosTab />}
      {tab === "library" && <LibraryTab />}
    </div>
  );
}

function LogTab({
  workouts,
  setWorkouts,
  weeklyBars,
  prs,
}: {
  workouts: Workout[];
  setWorkouts: (fn: (prev: Workout[]) => Workout[]) => void;
  weeklyBars: { label: string; value: number; hint?: string }[];
  prs: [string, { weightKg: number; reps: number; date: string }][];
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [focus, setFocus] = useState("Glutes & Legs");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([{ name: "", sets: [{ reps: 10, weightKg: 0 }] }]);

  function save() {
    const cleaned = exercises
      .map((e) => ({ ...e, name: e.name.trim() }))
      .filter((e) => e.name);
    setWorkouts((prev) =>
      [
        {
          id: uid(),
          date,
          focus: focus.trim() || "Training",
          exercises: cleaned,
          durationMin: duration ? Number(duration) : undefined,
          notes: notes.trim() || undefined,
        },
        ...prev,
      ].sort((a, b) => b.date.localeCompare(a.date))
    );
    setOpen(false);
    setExercises([{ name: "", sets: [{ reps: 10, weightKg: 0 }] }]);
    setNotes("");
    setDuration("");
  }

  return (
    <div>
      <div className="mb-5 flex justify-between">
        <SectionTitle>History</SectionTitle>
        <Button onClick={() => setOpen(true)}>Log a workout</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          {workouts.length === 0 ? (
            <EmptyState title="No workouts yet." hint="Log your first session — your future self is watching." />
          ) : (
            workouts.map((w) => (
              <Card key={w.id} className="p-4 sm:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg text-ink">{w.focus}</p>
                  <p className="text-xs text-faint">
                    {formatShort(w.date)}
                    {w.durationMin ? ` · ${w.durationMin} min` : ""}
                  </p>
                </div>
                {w.exercises.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {w.exercises.map((e, i) => (
                      <li key={i} className="text-sm text-soft">
                        {e.name}{" "}
                        <span className="text-faint">
                          {e.sets.map((s) => `${s.reps}x${s.weightKg}kg`).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {w.notes && <p className="mt-2 text-sm italic text-faint">{w.notes}</p>}
                <div className="mt-2 flex justify-end">
                  <Button variant="quiet" onClick={() => setWorkouts((prev) => prev.filter((x) => x.id !== w.id))}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Weekly summary</SectionTitle>
            <BarChart data={weeklyBars} height={110} />
            <p className="mt-2 text-xs text-faint">Workouts per week, last 8 weeks. Aim for 4 or more.</p>
          </Card>
          <Card>
            <SectionTitle>Personal records</SectionTitle>
            {prs.length === 0 ? (
              <p className="text-sm text-soft">Records appear once you log weighted sets.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {prs.slice(0, 8).map(([name, pr]) => (
                  <li key={name} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span className="truncate text-sm text-soft">{name}</span>
                    <span className="shrink-0 text-sm text-ink">
                      {pr.weightKg}kg × {pr.reps}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Log a workout" wide>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Focus">
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Glutes & Legs" />
          </Field>
          <Field label="Duration (min)">
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-faint">Exercises</p>
        <div className="space-y-3">
          {exercises.map((ex, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex gap-2">
                <Input
                  list="exercise-names"
                  value={ex.name}
                  onChange={(e) => setExercises((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Exercise name"
                />
                <Button variant="quiet" onClick={() => setExercises((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
              <datalist id="exercise-names">
                {EXERCISE_LIBRARY.map((e) => (
                  <option key={e.name} value={e.name} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {ex.sets.map((s, k) => (
                  <span key={k} className="flex items-center gap-1 rounded-lg bg-beige px-2 py-1">
                    <input
                      type="number"
                      className="w-12 bg-transparent text-sm text-ink focus:outline-none"
                      value={s.reps}
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps: Number(e.target.value) } : y)) } : x
                          )
                        )
                      }
                    />
                    <span className="text-xs text-faint">reps ×</span>
                    <input
                      type="number"
                      className="w-14 bg-transparent text-sm text-ink focus:outline-none"
                      value={s.weightKg}
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, weightKg: Number(e.target.value) } : y)) } : x
                          )
                        )
                      }
                    />
                    <span className="text-xs text-faint">kg</span>
                  </span>
                ))}
                <Button
                  variant="quiet"
                  onClick={() =>
                    setExercises((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, sets: [...x.sets, x.sets[x.sets.length - 1] || { reps: 10, weightKg: 0 }] } : x))
                    )
                  }
                >
                  Add set
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="ghost" onClick={() => setExercises((prev) => [...prev, { name: "", sets: [{ reps: 10, weightKg: 0 }] }])}>
            Add exercise
          </Button>
        </div>
        <div className="mt-4">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save}>Save workout</Button>
        </div>
      </Modal>
    </div>
  );
}

function PlanTab() {
  const [plan, setPlan] = useStore<Record<string, string>>("workoutPlan", {
    Monday: "Glutes & hamstrings",
    Tuesday: "",
    Wednesday: "Quads & glutes",
    Thursday: "",
    Friday: "Full lower body",
    Saturday: "Upper body & core",
    Sunday: "Rest — church day",
  });
  return (
    <Card>
      <SectionTitle>My training week</SectionTitle>
      <p className="mb-4 text-sm text-soft">A steady template beats a perfect one. Four training days keeps the weekly goal within reach.</p>
      <div className="space-y-2">
        {DAY_NAMES.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-soft">{d}</span>
            <Input value={plan[d] || ""} onChange={(e) => setPlan((p) => ({ ...p, [d]: e.target.value }))} placeholder="Rest" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function BodyTab() {
  const [measurements, setMeasurements] = useStore<Measurement[]>("measurements", []);
  const [form, setForm] = useState({ weightKg: "", waistCm: "", hipsCm: "", gluteCm: "", thighCm: "" });

  function add() {
    const entry: Measurement = {
      id: uid(),
      date: todayISO(),
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      waistCm: form.waistCm ? Number(form.waistCm) : undefined,
      hipsCm: form.hipsCm ? Number(form.hipsCm) : undefined,
      gluteCm: form.gluteCm ? Number(form.gluteCm) : undefined,
      thighCm: form.thighCm ? Number(form.thighCm) : undefined,
    };
    setMeasurements((prev) => [...prev.filter((m) => m.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)));
    setForm({ weightKg: "", waistCm: "", hipsCm: "", gluteCm: "", thighCm: "" });
  }

  const weightSeries = measurements.filter((m) => m.weightKg).map((m) => ({ label: formatShort(m.date), value: m.weightKg! }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionTitle>Log today</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["weightKg", "Weight (kg)"],
              ["hipsCm", "Hips (cm)"],
              ["gluteCm", "Glutes (cm)"],
              ["thighCm", "Thigh (cm)"],
              ["waistCm", "Waist (cm)"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <Input type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}>Save entry</Button>
        </div>
      </Card>
      <Card>
        <SectionTitle>Weight over time</SectionTitle>
        {weightSeries.length < 2 ? (
          <p className="text-sm text-soft">Log at least two entries to see the trend.</p>
        ) : (
          <LineChart points={weightSeries} unit="kg" />
        )}
      </Card>
      <Card className="lg:col-span-2">
        <SectionTitle>All entries</SectionTitle>
        {measurements.length === 0 ? (
          <p className="text-sm text-soft">No measurements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Weight</th>
                  <th className="py-2 pr-4 font-medium">Hips</th>
                  <th className="py-2 pr-4 font-medium">Glutes</th>
                  <th className="py-2 pr-4 font-medium">Thigh</th>
                  <th className="py-2 pr-4 font-medium">Waist</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-line-soft text-soft">
                    <td className="py-2 pr-4">{formatShort(m.date)}</td>
                    <td className="py-2 pr-4">{m.weightKg ?? "—"}</td>
                    <td className="py-2 pr-4">{m.hipsCm ?? "—"}</td>
                    <td className="py-2 pr-4">{m.gluteCm ?? "—"}</td>
                    <td className="py-2 pr-4">{m.thighCm ?? "—"}</td>
                    <td className="py-2 pr-4">{m.waistCm ?? "—"}</td>
                    <td className="py-2 text-right">
                      <Button variant="quiet" onClick={() => setMeasurements((prev) => prev.filter((x) => x.id !== m.id))}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function PhotosTab() {
  const [photos, setPhotos] = useStore<ProgressPhoto[]>("photos", []);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        const blob = await getImage(p.id);
        if (blob) out[p.id] = URL.createObjectURL(blob);
      }
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  async function upload(file: File) {
    const id = uid();
    await putImage(id, file);
    setPhotos((prev) => [{ id, date: todayISO() }, ...prev]);
  }

  return (
    <div>
      <Card className="mb-6">
        <SectionTitle>Add a progress photo</SectionTitle>
        <p className="mb-3 text-sm text-soft">Photos are stored privately on this device.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="text-sm text-soft file:mr-3 file:rounded-full file:border-0 file:bg-brown file:px-4 file:py-1.5 file:text-sm file:text-white hover:file:bg-brown-deep"
        />
      </Card>
      {photos.length === 0 ? (
        <EmptyState title="No photos yet." hint="A photo a month tells a story the scale cannot." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              {urls[p.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[p.id]} alt={`Progress ${p.date}`} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full bg-beige" />
              )}
              <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-faint">
                {formatShort(p.date)}
                <button
                  className="hover:text-ink"
                  onClick={async () => {
                    await deleteImage(p.id);
                    setPhotos((prev) => prev.filter((x) => x.id !== p.id));
                  }}
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryTab() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {EXERCISE_LIBRARY.map((e) => (
        <Card key={e.name} className="p-4 sm:p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-lg text-ink">{e.name}</p>
            <Tag>{e.target}</Tag>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-soft">{e.cue}</p>
        </Card>
      ))}
    </div>
  );
}
