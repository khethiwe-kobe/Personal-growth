"use client";

import { useEffect, useState } from "react";
import { Feed } from "@/components/Feed";
import { Page } from "@/components/Page";
import { Scoreboard } from "@/components/Scoreboard";
import { rdCountdown, rdLongDate } from "@/lib/rd";

type Tab = "feed" | "scoreboard";

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>("feed");

  // Remember the last tab on this device.
  useEffect(() => {
    try {
      const t = localStorage.getItem("rd-coach:team-tab");
      if (t === "feed" || t === "scoreboard") setTab(t);
    } catch {
      // Ignore.
    }
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("rd-coach:team-tab", t);
    } catch {
      // Ignore.
    }
  };

  return (
    <Page
      title="JHB team"
      intro={`Everyone's sessions, personal bests and progress photos. ${rdCountdown()}: ${rdLongDate()}.`}
      aside={
        <div className="flex rounded-lg border border-line-2 overflow-hidden text-sm">
          {(["feed", "scoreboard"] as const).map((t) => (
            <button key={t} onClick={() => choose(t)} className={`px-4 py-2 ${tab === t ? "bg-accent text-surface" : "text-ink-2 hover:bg-surface-2"}`}>
              {t === "feed" ? "Feed" : "Scoreboard"}
            </button>
          ))}
        </div>
      }
    >
      {tab === "feed" ? (
        <div className="max-w-2xl">
          <Feed />
        </div>
      ) : (
        <Scoreboard />
      )}
    </Page>
  );
}
