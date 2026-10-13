"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/store";
import type { FeedPost } from "@/lib/types";
import { PhotoComposer } from "./PhotoComposer";
import { PostCard } from "./PostCard";

/** The team feed. With `memberId`, only that person's posts and no composer. */
export function Feed({ memberId }: { memberId?: string }) {
  const me = useMe();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (before) q.set("before", before);
        if (memberId) q.set("member", memberId);
        const res = await api<{ posts: FeedPost[]; next: string | null }>(`/api/feed?${q}`);
        setPosts((cur) => (before && cur ? [...cur, ...res.posts] : res.posts));
        setNext(res.next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the feed.");
      } finally {
        setLoading(false);
      }
    },
    [memberId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!me) return null;

  return (
    <div className="flex flex-col gap-4">
      {!memberId &&
        (composing ? (
          <PhotoComposer
            onClose={() => setComposing(false)}
            onPosted={() => {
              setComposing(false);
              void load();
            }}
          />
        ) : (
          <button className="card p-4 text-left text-ink-2 hover:bg-surface-2 transition-colors" onClick={() => setComposing(true)}>
            <span className="font-medium text-ink">Post today&apos;s progress photo.</span> Take one now or upload from your gallery.
          </button>
        ))}

      {error && <div className="text-sm text-ink-2 bg-surface-2 rounded-lg px-3 py-2">{error}</div>}

      {posts?.length === 0 && (
        <div className="card p-6 text-ink-2 leading-relaxed">
          {memberId
            ? "Nothing shared yet."
            : "Nothing here yet. Sessions you report to your coach, new personal bests and progress photos appear here for the whole group."}
        </div>
      )}

      {posts?.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          me={me}
          onChange={(np) => setPosts((cur) => cur?.map((x) => (x.id === np.id ? np : x)) ?? null)}
          onDeleted={() => setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? null)}
        />
      ))}

      {posts === null && loading && <div className="text-sm text-ink-3 px-1">Loading…</div>}
      {next && (
        <button className="btn btn-ghost self-center" disabled={loading} onClick={() => load(next)}>
          {loading ? "Loading…" : "Show older posts"}
        </button>
      )}
    </div>
  );
}
