import { newId, sql } from "./db";
import { REACTIONS, type FeedComment, type FeedPost, type PostDraft, type PostKind } from "../types";

export async function insertPosts(memberId: string, drafts: PostDraft[]): Promise<void> {
  for (const d of drafts) {
    await sql("INSERT INTO posts (id, member_id, kind, day, data) VALUES ($1, $2, $3, $4, $5::jsonb)", [
      newId(),
      memberId,
      d.kind,
      d.day,
      JSON.stringify(d.data),
    ]);
  }
}

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function createPhotoPost(memberId: string, day: string, mime: string, bytes: Uint8Array, caption: string): Promise<string> {
  const photoId = newId();
  const postId = newId();
  await sql("INSERT INTO photos (id, member_id, mime, data) VALUES ($1, $2, $3, $4)", [photoId, memberId, mime, Buffer.from(bytes).toString("base64")]);
  await sql("INSERT INTO posts (id, member_id, kind, day, data, photo_id) VALUES ($1, $2, 'photo', $3, $4::jsonb, $5)", [
    postId,
    memberId,
    day,
    JSON.stringify(caption ? { caption } : {}),
    photoId,
  ]);
  return postId;
}

export async function getPhoto(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const rows = await sql<{ mime: string; data: string }>(
    "SELECT p.mime, p.data FROM photos p JOIN members m ON m.id = p.member_id WHERE p.id = $1 AND NOT m.removed",
    [id],
  );
  return rows[0] ? { mime: rows[0].mime, bytes: Buffer.from(rows[0].data, "base64") } : null;
}

/** Days with a progress photo, per member, for the scoreboard. */
export async function photoDays(): Promise<Map<string, string[]>> {
  const rows = await sql<{ member_id: string; day: string }>("SELECT DISTINCT member_id, day FROM posts WHERE kind = 'photo'");
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.member_id, [...(map.get(r.member_id) ?? []), r.day]);
  return map;
}

type PostRow = {
  id: string;
  member_id: string;
  display_name: string;
  kind: PostKind;
  day: string;
  data: Record<string, unknown>;
  photo_id: string | null;
  created_at: string;
};

const PAGE = 20;

/** Newest posts first. `before` is the createdAt|id of the last post already shown. */
export async function feed(viewerId: string, opts: { before?: string; memberId?: string } = {}): Promise<{ posts: FeedPost[]; more: boolean }> {
  const params: unknown[] = [];
  const where = ["NOT m.removed"];
  if (opts.memberId) {
    params.push(opts.memberId);
    where.push(`p.member_id = $${params.length}`);
  }
  if (opts.before) {
    const [at, id] = opts.before.split("|");
    params.push(at, id ?? "");
    where.push(`(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length})`);
  }
  params.push(PAGE + 1);
  const rows = await sql<PostRow>(
    `SELECT p.id, p.member_id, m.display_name, p.kind, p.day, p.data, p.photo_id, p.created_at
       FROM posts p JOIN members m ON m.id = p.member_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${params.length}`,
    params,
  );
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  if (!page.length) return { posts: [], more: false };
  const ids = page.map((r) => r.id);

  const reactions = await sql<{ post_id: string; kind: string; n: string | number; mine: boolean }>(
    `SELECT post_id, kind, COUNT(*) AS n, BOOL_OR(member_id = $2) AS mine
       FROM reactions WHERE post_id = ANY($1::text[]) GROUP BY post_id, kind`,
    [ids, viewerId],
  );
  const comments = await sql<{ id: string; post_id: string; member_id: string; display_name: string; body: string; created_at: string }>(
    `SELECT c.id, c.post_id, c.member_id, m.display_name, c.body, c.created_at
       FROM comments c JOIN members m ON m.id = c.member_id
      WHERE c.post_id = ANY($1::text[]) AND NOT m.removed
      ORDER BY c.created_at`,
    [ids],
  );

  const posts: FeedPost[] = page.map((r) => {
    const rs = reactions.filter((x) => x.post_id === r.id);
    return {
      id: r.id,
      memberId: r.member_id,
      name: r.display_name,
      kind: r.kind,
      day: r.day,
      data: r.data ?? {},
      photoId: r.photo_id,
      createdAt: new Date(r.created_at).toISOString(),
      reactions: Object.fromEntries(rs.map((x) => [x.kind, Number(x.n)])),
      mine: rs.filter((x) => x.mine).map((x) => x.kind),
      comments: comments
        .filter((c) => c.post_id === r.id)
        .map<FeedComment>((c) => ({ id: c.id, memberId: c.member_id, name: c.display_name, body: c.body, createdAt: new Date(c.created_at).toISOString() })),
    };
  });
  const last = page[page.length - 1];
  return { posts, more: more && !!last };
}

export function cursorOf(p: FeedPost): string {
  return `${p.createdAt}|${p.id}`;
}

export async function postOwner(postId: string): Promise<string | null> {
  const rows = await sql<{ member_id: string }>("SELECT member_id FROM posts WHERE id = $1", [postId]);
  return rows[0]?.member_id ?? null;
}

export async function deletePost(postId: string): Promise<void> {
  const rows = await sql<{ photo_id: string | null }>("DELETE FROM posts WHERE id = $1 RETURNING photo_id", [postId]);
  if (rows[0]?.photo_id) await sql("DELETE FROM photos WHERE id = $1", [rows[0].photo_id]);
}

export async function toggleReaction(postId: string, memberId: string, kind: string): Promise<void> {
  if (!REACTIONS.some((r) => r.id === kind)) throw new Error("Unknown reaction.");
  const removed = await sql("DELETE FROM reactions WHERE post_id = $1 AND member_id = $2 AND kind = $3 RETURNING kind", [postId, memberId, kind]);
  if (!removed.length) {
    await sql("INSERT INTO reactions (post_id, member_id, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [postId, memberId, kind]);
  }
}

export async function addComment(postId: string, memberId: string, name: string, body: string): Promise<FeedComment> {
  const rows = await sql<{ id: string; created_at: string }>(
    "INSERT INTO comments (id, post_id, member_id, body) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
    [newId(), postId, memberId, body],
  );
  return { id: rows[0].id, memberId, name, body, createdAt: new Date(rows[0].created_at).toISOString() };
}

export async function commentOwner(commentId: string): Promise<string | null> {
  const rows = await sql<{ member_id: string }>("SELECT member_id FROM comments WHERE id = $1", [commentId]);
  return rows[0]?.member_id ?? null;
}

export async function deleteComment(commentId: string): Promise<void> {
  await sql("DELETE FROM comments WHERE id = $1", [commentId]);
}

export async function postExists(postId: string): Promise<boolean> {
  const rows = await sql("SELECT 1 FROM posts p JOIN members m ON m.id = p.member_id WHERE p.id = $1 AND NOT m.removed", [postId]);
  return rows.length > 0;
}
