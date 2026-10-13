import { test } from "node:test";
import assert from "node:assert/strict";

import { createMember, currentMember, findLogin, startSession } from "../lib/server/session";
import * as social from "../lib/server/social";
import { allPublicProgress, loadState, saveState } from "../lib/server/state";
import { EMPTY_STATE } from "../lib/types";

// The database connects lazily on first query, so this takes effect in time.
process.env.DATABASE_URL = "pglite:memory";

const cookieOf = (setCookie: string) => new Request("http://x/", { headers: { cookie: setCookie.split(";")[0] } });

test("first member is admin; passwords are checked; sessions identify members", async () => {
  const ama = await createMember("ama", "Ama", "secret1");
  const ben = await createMember("ben", "Ben", "secret2");
  assert.equal(ama.isAdmin, true);
  assert.equal(ben.isAdmin, false);
  assert.equal(await findLogin("ama", "wrong"), null);
  assert.equal((await findLogin("ama", "secret1"))?.id, ama.id);
  const req = cookieOf(await startSession(ben.id));
  assert.equal((await currentMember(req))?.username, "ben");
  assert.equal(await currentMember(new Request("http://x/")), null);
});

test("private coaching data stays private; progress is shared", async () => {
  const [ama] = (await allPublicProgress()).filter((m) => m.name === "Ama");
  const state = {
    ...EMPTY_STATE,
    profile: { injuries: "left knee" },
    history: [{ role: "user" as const, parts: [{ text: "hello" }] }],
    logs: [{ id: "l1", date: "2026-10-13", session: "Lower", completed: true, exercises: [] }],
  };
  await saveState(ama.id, state);
  const own = await loadState(ama.id);
  assert.equal(own.state.profile.injuries, "left knee");
  assert.equal(own.state.history.length, 1);
  const shared = (await allPublicProgress()).find((m) => m.id === ama.id)!;
  assert.equal(shared.progress.logs.length, 1);
  assert.equal(JSON.stringify(shared).includes("left knee"), false);
  assert.equal(JSON.stringify(shared).includes("hello"), false);
});

test("feed: posts, photos, reactions toggle, comments, deletion", async () => {
  const members = await allPublicProgress();
  const ama = members.find((m) => m.name === "Ama")!;
  const ben = members.find((m) => m.name === "Ben")!;
  await social.insertPosts(ama.id, [{ kind: "session", day: "2026-10-13", data: { session: "Lower", completed: true } }]);
  const photoPost = await social.createPhotoPost(ben.id, "2026-10-13", "image/jpeg", new Uint8Array([1, 2, 3]), "Leg day");

  let { posts } = await social.feed(ama.id);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].id, photoPost);
  assert.equal(posts[0].data.caption, "Leg day");
  const photo = await social.getPhoto(posts[0].photoId!);
  assert.deepEqual([...photo!.bytes], [1, 2, 3]);

  await social.toggleReaction(photoPost, ama.id, "strong");
  await social.toggleReaction(photoPost, ben.id, "strong");
  await social.toggleReaction(photoPost, ama.id, "respect");
  await social.toggleReaction(photoPost, ama.id, "respect");
  const c = await social.addComment(photoPost, ama.id, "Ama", "Great work");
  ({ posts } = await social.feed(ama.id));
  assert.deepEqual(posts[0].reactions, { strong: 2 });
  assert.deepEqual(posts[0].mine, ["strong"]);
  assert.equal(posts[0].comments[0].body, "Great work");
  await assert.rejects(social.toggleReaction(photoPost, ama.id, "fire"));

  assert.deepEqual([...(await social.photoDays()).get(ben.id)!], ["2026-10-13"]);
  await social.deleteComment(c.id);
  await social.deletePost(photoPost);
  ({ posts } = await social.feed(ama.id));
  assert.equal(posts.length, 1);
  assert.equal(await social.getPhoto(photoPost), null);
});

test("feed pages back with a cursor", async () => {
  const ama = (await allPublicProgress()).find((m) => m.name === "Ama")!;
  await social.insertPosts(
    ama.id,
    Array.from({ length: 25 }, (_, i) => ({ kind: "session" as const, day: "2026-10-14", data: { session: `S${i}`, completed: true } })),
  );
  const first = await social.feed(ama.id);
  assert.equal(first.posts.length, 20);
  assert.equal(first.more, true);
  const second = await social.feed(ama.id, { before: social.cursorOf(first.posts[19]) });
  assert.equal(second.posts.length, 6);
  assert.equal(new Set([...first.posts, ...second.posts].map((p) => p.id)).size, 26);
});
