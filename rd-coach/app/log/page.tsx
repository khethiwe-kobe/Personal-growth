"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, Page } from "@/components/Page";
import { setState, useCoachState } from "@/lib/store";

export default function LogPage() {
  const { logs } = useCoachState();
  const [open, setOpen] = useState<string | null>(logs[0]?.id ?? null);

  const remove = (id: string) => {
    if (!window.confirm("Delete this session from the log? The coach will be told on your next message.")) return;
    setState((s) => ({ ...s, logs: s.logs.filter((l) => l.id !== id), stateVersion: s.stateVersion + 1 }));
  };

  if (logs.length === 0) {
    return (
      <Page title="Training log">
        <Empty>
          Sessions are logged here after you report them to your coach. Use{" "}
          <Link href="/" className="text-accent-ink underline">
            Report a session
          </Link>{" "}
          on the Coach page once you have trained.
        </Empty>
      </Page>
    );
  }

  const completed = logs.filter((l) => l.completed).length;

  return (
    <Page
      title="Training log"
      intro={`${logs.length} session${logs.length === 1 ? "" : "s"} recorded, ${completed} completed in full.`}
    >
      <div className="flex flex-col gap-3">
        {logs.map((w) => {
          const isOpen = open === w.id;
          return (
            <div key={w.id} className="card overflow-hidden">
              <button className="w-full text-left px-5 py-4 flex items-center justify-between gap-4" onClick={() => setOpen(isOpen ? null : w.id)}>
                <div>
                  <div className="font-medium">{w.session}</div>
                  <div className="text-xs text-ink-3 mt-0.5">
                    {w.date}
                    {!w.completed && <span className="ml-2 text-danger">Incomplete</span>}
                    {w.pain && <span className="ml-2">Pain noted</span>}
                  </div>
                </div>
                <span className="text-xs text-ink-3">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-5 pb-5 pt-3 fade-in">
                  {w.exercises.length > 0 && (
                    <table className="data-table mb-4">
                      <thead>
                        <tr>
                          <th>Exercise</th>
                          <th>Sets</th>
                          <th>Reps</th>
                          <th>Load</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.exercises.map((e, i) => (
                          <tr key={i}>
                            <td className="font-medium">{e.name}</td>
                            <td className="text-ink-2">{e.sets ?? ""}</td>
                            <td className="text-ink-2">{e.reps ?? ""}</td>
                            <td className="text-ink-2">{e.load ?? ""}</td>
                            <td className="text-ink-3">{e.notes ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {w.felt_easy && (
                      <div>
                        <dt className="label">Felt easy</dt>
                        <dd className="text-ink-2 mt-0.5">{w.felt_easy}</dd>
                      </div>
                    )}
                    {w.felt_hard && (
                      <div>
                        <dt className="label">Felt hard</dt>
                        <dd className="text-ink-2 mt-0.5">{w.felt_hard}</dd>
                      </div>
                    )}
                    {w.pain && (
                      <div>
                        <dt className="label">Pain or discomfort</dt>
                        <dd className="text-ink-2 mt-0.5">{w.pain}</dd>
                      </div>
                    )}
                    {w.coach_notes && (
                      <div className="sm:col-span-2">
                        <dt className="label">Coach&apos;s note</dt>
                        <dd className="text-ink-2 mt-0.5 leading-relaxed">{w.coach_notes}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-4 text-right">
                    <button className="text-xs text-ink-3 hover:text-danger" onClick={() => remove(w.id)}>
                      Delete entry
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
