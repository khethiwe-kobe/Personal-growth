"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/time";
import { REACTIONS, type FeedComment, type FeedPost, type Member } from "@/lib/types";

type Exercise = { name?: string; sets?: number; reps?: string; load?: string };

function exerciseLine(e: Exercise): string {
  const volume = e.sets && e.reps ? `${e.sets} x ${e.reps}` : e.reps ?? (e.sets ? `${e.sets} sets` : "");
  return [e.name, volume, e.load ? `at ${e.load}` : ""].filter(Boolean).join(" ");
}

function fmt(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(n);
}

/** What happened, in one line, plus any detail underneath. */
function Body({ post }: { post: FeedPost }) {
  const d = post.data as Record<string, unknown>;
  switch (post.kind) {
    case "session": {
      const ex = (Array.isArray(d.exercises) ? d.exercises : []) as Exercise[];
      return (
        <>
          <p>
            {d.completed ? "Completed" : "Logged part of"} <strong>{String(d.session ?? "a session")}</strong>
          </p>
          {ex.length > 0 && (
            <ul className="mt-2 text-sm text-ink-2 flex flex-col gap-0.5">
              {ex.slice(0, 8).map((e, i) => (
                <li key={i}>{exerciseLine(e)}</li>
              ))}
              {ex.length > 8 && <li className="text-ink-3">and {ex.length - 8} more</li>}
            </ul>
          )}
          {typeof d.felt_hard === "string" && <p className="mt-2 text-sm text-ink-3">Hardest part: {d.felt_hard}</p>}
        </>
      );
    }
    case "baseline":
      return (
        <p>
          Set a baseline: <strong>{String(d.label)}</strong> {fmt(d.value)} {String(d.unit)}
        </p>
      );
    case "best":
      return (
        <p>
          New personal best: <strong>{String(d.label)}</strong> {fmt(d.value)} {String(d.unit)}
          <span className="text-ink-3"> (was {fmt(d.previous)})</span>
        </p>
      );
    case "programme":
      return (
        <p>
          Started {d.total_weeks ? `a ${String(d.total_weeks)}-week programme` : "a new programme"}: <strong>{String(d.title)}</strong>
        </p>
      );
    case "week_goal":
      return (
        <p>
          Hit this week&apos;s target: <strong>{String(d.sessions)} of {String(d.planned)}</strong> sessions.
          {Number(d.streak) > 1 && <span className="text-ink-2"> {String(d.streak)} weeks in a row.</span>}
        </p>
      );
    case "photo":
      return typeof d.caption === "string" && d.caption ? <p className="whitespace-pre-wrap">{d.caption}</p> : null;
    default:
      return null;
  }
}

const KIND_LABEL: Record<string, string> = {
  session: "Session",
  baseline: "Baseline",
  best: "Personal best",
  programme: "Programme",
  week_goal: "Week target",
  photo: "Progress photo",
};

export function PostCard({ post, me, onChange, onDeleted }: { post: FeedPost; me: Member; onChange: (p: FeedPost) => void; onDeleted: () => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const react = async (kind: string) => {
    const on = post.mine.includes(kind);
    // Show the change at once; the server confirms it.
    onChange({
      ...post,
      mine: on ? post.mine.filter((k) => k !== kind) : [...post.mine, kind],
      reactions: { ...post.reactions, [kind]: Math.max(0, (post.reactions[kind] ?? 0) + (on ? -1 : 1)) },
    });
    try {
      await api(`/api/posts/${post.id}/reactions`, { method: "POST", body: JSON.stringify({ kind }) });
    } catch {
      onChange(post);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ comment: FeedComment }>(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      onChange({ ...post, comments: [...post.comments, res.comment] });
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the comment.");
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (id: string) => {
    if (!window.confirm("Delete this comment?")) return;
    await api(`/api/comments/${id}`, { method: "DELETE" });
    onChange({ ...post, comments: post.comments.filter((c) => c.id !== id) });
  };

  const removePost = async () => {
    if (!window.confirm("Delete this post for everyone?")) return;
    await api(`/api/posts/${post.id}`, { method: "DELETE" });
    onDeleted();
  };

  const canDelete = post.memberId === me.id || me.isAdmin;
  const comments = showAll ? post.comments : post.comments.slice(-3);

  return (
    <article className="card overflow-hidden fade-in">
      <div className="px-5 pt-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/team/${post.memberId}`} className="font-medium hover:underline">
            {post.memberId === me.id ? "You" : post.name}
          </Link>
          <span className="text-xs text-ink-3 ml-2">{KIND_LABEL[post.kind] ?? ""}</span>
        </div>
        <span className="text-xs text-ink-3 whitespace-nowrap">{relativeTime(post.createdAt)}</span>
      </div>

      <div className="px-5 pt-2 pb-3 leading-relaxed">
        <Body post={post} />
      </div>

      {post.photoId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/photos/${post.photoId}`} alt={`Progress photo from ${post.name}`} loading="lazy" className="w-full max-h-[70vh] object-cover bg-surface-2" />
      )}

      <div className="px-5 py-3 flex flex-wrap items-center gap-1.5 border-t border-line">
        {REACTIONS.map((r) => {
          const n = post.reactions[r.id] ?? 0;
          const on = post.mine.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => react(r.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                on ? "bg-accent text-surface border-accent" : "border-line-2 text-ink-2 hover:bg-surface-2"
              }`}
              aria-pressed={on}
            >
              {r.label}
              {n > 0 && <span className={on ? "ml-1.5" : "ml-1.5 text-ink-3"}>{n}</span>}
            </button>
          );
        })}
        {canDelete && (
          <button className="ml-auto text-xs text-ink-3 hover:text-danger" onClick={removePost}>
            Delete
          </button>
        )}
      </div>

      <div className="px-5 pb-4 flex flex-col gap-2">
        {post.comments.length > 3 && !showAll && (
          <button className="text-xs text-ink-3 hover:text-ink self-start" onClick={() => setShowAll(true)}>
            Show all {post.comments.length} comments
          </button>
        )}
        {comments.map((c) => (
          <div key={c.id} className="text-sm leading-relaxed group">
            <span className="font-medium">{c.memberId === me.id ? "You" : c.name}</span>{" "}
            <span className="text-ink-2 whitespace-pre-wrap">{c.body}</span>
            <span className="text-xs text-ink-3 ml-2">{relativeTime(c.createdAt)}</span>
            {(c.memberId === me.id || me.isAdmin) && (
              <button className="text-xs text-ink-3 hover:text-danger ml-2" onClick={() => removeComment(c.id)}>
                Delete
              </button>
            )}
          </div>
        ))}
        <form onSubmit={addComment} className="flex gap-2 mt-1">
          <input className="input !py-1.5 text-sm" placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <button className="btn btn-ghost !py-1.5 !text-sm" disabled={busy || !comment.trim()}>
            Post
          </button>
        </form>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </article>
  );
}
