import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialContent, expandDemoSeedContent, deserializeContent, publishPost,
  publishComment, grantDailyCoins, tipPerson, giftPostAuthor, removePost, setPostLike,
} from "../src/lib/content-model.ts";

const now = Date.parse("2026-11-23T08:00:00Z");
function legacy() {
  const state = createInitialContent(now - 86_400_000);
  state.posts = state.posts.filter((post) => Number(post.id.slice(5)) <= 6);
  const ids = new Set(state.posts.map((post) => post.id));
  state.comments = state.comments.filter((comment) => ids.has(comment.postId));
  state.likes = state.likes.filter((like) => ids.has(like.postId));
  delete state.demoSeedRevision;
  return state;
}

test("demo expansion appends new samples while preserving existing authors, edits, deletions, interactions and wallet history", () => {
  let state = removePost(legacy(), "moonlight", "post-02");
  state.posts[0] = { ...state.posts[0], body: "本机保留的旧正文" };
  const posted = publishPost(state, "alice", { personId: "qin", body: "用户自己写的帖子", topicIds: [] }, "own", now - 1000);
  state = publishComment(posted.state, "bob", posted.id, { personId: "zeus", body: "用户自己的评论", topicIds: [] }, "reply", now).state;
  state = setPostLike(state, "bob", posted.id, true, now);
  state = tipPerson(grantDailyCoins(state, "alice", now), "alice", "qin", 3, "character-tip", now);
  state = giftPostAuthor(state, "alice", "post-01", 2, "post-gift", now);
  const before = JSON.stringify(state);
  const expanded = expandDemoSeedContent(state, now);
  assert.equal(expanded.posts.length, state.posts.length + 10);
  assert.deepEqual(expanded.posts.slice(0, state.posts.length), state.posts);
  assert.deepEqual(expanded.comments.slice(0, state.comments.length), state.comments);
  assert.deepEqual(expanded.likes.slice(0, state.likes.length), state.likes);
  for (const key of ["transactions", "reviews", "pollVotes", "characterRequests", "reports", "requests", "recentPeople"]) assert.equal(expanded[key], state[key]);
  assert.equal(expanded.posts.some((post) => post.id === "post-02"), false);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(deserializeContent(JSON.stringify(expanded)), expanded);
});

test("expansion is idempotent across refreshes and respects subsequent sample deletion and unlikes", () => {
  const expanded = expandDemoSeedContent(legacy(), now);
  const unliked = setPostLike(expanded, "audience_0", "post-08", false, now);
  const removed = removePost(unliked, "dongpo_kitchen", "post-07");
  const restored = deserializeContent(JSON.stringify(removed));
  assert.equal(expandDemoSeedContent(restored, now + 86_400_000), restored);
  assert.equal(restored.posts.some((post) => post.id === "post-07"), false);
  assert.equal(restored.likes.some((like) => like.postId === "post-08" && like.handle === "audience_0"), false);
});

test("partially present samples are not overwritten or assigned duplicate activity during expansion", () => {
  const state = legacy();
  const sample = createInitialContent(now).posts.find((post) => post.id === "post-07");
  state.posts.push({ ...sample, body: "已存在且编辑过的示例" });
  const expanded = expandDemoSeedContent(state, now);
  assert.equal(expanded.posts.length, state.posts.length + 9);
  assert.equal(expanded.posts.find((post) => post.id === "post-07").body, "已存在且编辑过的示例");
  assert.equal(expanded.comments.some((comment) => comment.postId === "post-07"), false);
  assert.equal(expanded.likes.some((like) => like.postId === "post-07"), false);
  assert.deepEqual(deserializeContent(JSON.stringify(expanded)), expanded);
});
