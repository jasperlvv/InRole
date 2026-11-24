import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY, createInitialContent, publishPost, publishComment, setPostLike, removePost, removeComment,
  postStats, rankPosts, rankTopics, deserializeContent, saveReview, removeReview, personStats,
  grantDailyCoins, tipPerson, walletBalance, chinaDay, rankPeople, reportContent,
} from "../src/lib/content-model.ts";

const now = Date.parse("2026-11-22T08:00:00Z");
const empty = () => ({ ...createInitialContent(now), posts: [], comments: [], likes: [], reviews: [], transactions: [], reports: [], requests: {}, recentPeople: {} });
const draft = (personId = "qin", body = "换个身份，说你的话。", topicIds = ["history-work"]) => ({ personId, body, topicIds });
const post = (state = empty(), handle = "alice", request = "first", at = now) => publishPost(state, handle, draft(), request, at);

test("public roles can be shared while each post and comment keeps its own immutable identity", () => {
  const first = post();
  const second = publishPost(first.state, "alice", draft("zeus"), "second", now + 1);
  const shared = publishPost(second.state, "bob", draft("qin"), "third", now + 2);
  const comment = publishComment(shared.state, "alice", first.id, draft("wukong", "换个身份接戏。"), "reply", now + 3);
  assert.equal(comment.state.posts.find(p => p.id === first.id).personId, "qin");
  assert.equal(comment.state.posts.find(p => p.id === second.id).personId, "zeus");
  assert.equal(comment.state.comments[0].personId, "wukong");
  assert.equal(first.state.comments.length, 0);
  assert.deepEqual(comment.state.recentPeople.alice, ["wukong", "zeus", "qin"]);
});

test("guest and invalid actors cannot write any model resource", () => {
  const saved = post();
  for (const actor of [null, "", "A", "user name"]) {
    assert.throws(() => publishPost(saved.state, actor, draft(), "guest", now));
    assert.throws(() => publishComment(saved.state, actor, saved.id, draft(), "reply", now));
    assert.throws(() => setPostLike(saved.state, actor, saved.id, true, now));
    assert.throws(() => removePost(saved.state, actor, saved.id));
    assert.throws(() => saveReview(saved.state, actor, "qin", 5, "", now));
    assert.throws(() => grantDailyCoins(saved.state, actor, now));
    assert.throws(() => reportContent(saved.state, actor, "post", saved.id, "其他", now));
  }
});

test("publication validates role, whitespace, Unicode body length and topic limits", () => {
  assert.throws(() => publishPost(empty(), "alice", draft("unknown"), "a", now));
  assert.throws(() => publishPost(empty(), "alice", draft("qin", "  \n "), "a", now));
  assert.throws(() => publishPost(empty(), "alice", draft("qin", "🦊".repeat(501)), "a", now));
  assert.equal(publishPost(empty(), "alice", draft("qin", " 🦊 "), "a", now).state.posts[0].body, "🦊");
  assert.throws(() => publishPost(empty(), "alice", draft("qin", "有效正文", ["unknown"]), "a", now));
  assert.throws(() => publishPost(empty(), "alice", draft("qin", "有效正文", ["history-work", "gods-work", "ancient-moments", "daily-troubles"]), "a", now));
});

test("repeated create requests are idempotent and scoped to the actual author", () => {
  const first = post();
  const again = publishPost(first.state, "alice", draft("zeus", "重复提交"), "first", now + 1);
  assert.equal(again.id, first.id); assert.equal(again.state.posts.length, 1);
  const other = publishPost(again.state, "bob", draft(), "first", now + 2);
  assert.notEqual(other.id, first.id);
  const reply = publishComment(other.state, "alice", first.id, draft("wukong"), "reply", now);
  const replyAgain = publishComment(reply.state, "alice", first.id, draft("zeus"), "reply", now + 1);
  assert.equal(replyAgain.state.comments.length, 1);
  assert.equal(replyAgain.state.comments[0].personId, "wukong");
  const anotherPost = publishComment(replyAgain.state, "alice", other.id, draft("zeus"), "reply", now + 2);
  assert.notEqual(anotherPost.id, reply.id);
  assert.equal(anotherPost.state.comments.length, 2);
  assert.doesNotThrow(() => deserializeContent(JSON.stringify(anotherPost.state)));
});

test("likes are unique per real account, independent of role and safe to cancel", () => {
  const saved = post();
  const liked = setPostLike(saved.state, "bob", saved.id, true, now);
  const repeated = setPostLike(liked, "bob", saved.id, true, now + 1);
  assert.equal(postStats(repeated, saved.id, "bob").likes, 1);
  const two = setPostLike(repeated, "charlie", saved.id, true, now + 2);
  const canceled = setPostLike(two, "bob", saved.id, false, now + 3);
  assert.deepEqual(postStats(canceled, saved.id, "bob"), { likes: 1, comments: 0, liked: false, gifts: 0, gifted: false });
});

test("only the owner can delete content and deleting a post removes its discussion and likes", () => {
  const saved = post(); const reply = publishComment(saved.state, "bob", saved.id, draft("wukong"), "r", now);
  const liked = setPostLike(reply.state, "bob", saved.id, true, now);
  assert.throws(() => removePost(liked, "bob", saved.id));
  assert.throws(() => removeComment(liked, "alice", reply.id));
  const deletedReply = removeComment(liked, "bob", reply.id);
  assert.throws(() => publishComment(deletedReply, "bob", saved.id, draft(), "r", now + 1));
  const deleted = removePost(liked, "alice", saved.id);
  assert.equal(deleted.posts.length + deleted.comments.length + deleted.likes.length, 0);
});

test("storage round trips keep content, roles, reactions and recent people", () => {
  const saved = post(); const reply = publishComment(saved.state, "bob", saved.id, draft("wukong"), "r", now);
  const liked = setPostLike(reply.state, "bob", saved.id, true, now);
  assert.deepEqual(deserializeContent(JSON.stringify(liked)), liked);
  assert.throws(() => deserializeContent("{bad json"));
  assert.throws(() => deserializeContent(JSON.stringify({ ...liked, likes: [...liked.likes, ...liked.likes] })));
  assert.doesNotThrow(() => deserializeContent(JSON.stringify(createInitialContent(now))));
});

test("post heat counts recent independent readers, excluding self and repeated comments", () => {
  const saved = post(empty(), "alice", "old", now - 3 * DAY);
  let state = publishComment(saved.state, "bob", saved.id, draft("wukong"), "r1", now - 1_000).state;
  state = publishComment(state, "bob", saved.id, draft("zeus"), "r2", now - 2_000).state;
  state = publishComment(state, "alice", saved.id, draft(), "self", now - 3_000).state;
  state = publishComment(state, "charlie", saved.id, draft(), "old-reply", now - 2 * DAY).state;
  state = setPostLike(state, "bob", saved.id, true, now - 1_000);
  state = setPostLike(state, "alice", saved.id, true, now - 1_000);
  assert.equal(rankPosts(state, 1, now)[0].score, 4);
  assert.equal(rankPosts(state, 7, now)[0].score, 7);
  const next = publishPost(state, "alice", draft(), "new", now - 500);
  const both = setPostLike(next.state, "bob", next.id, true, now - 100);
  assert.equal(rankTopics(both, 1, now).find(item => item.topic.id === "history-work").score, 6);
});

test("Beijing midnight resets daily eligibility, never issuing duplicate grants", () => {
  const before = Date.parse("2026-11-22T15:59:00Z"); const after = Date.parse("2026-11-22T16:01:00Z");
  assert.equal(chinaDay(before), "2026-11-22"); assert.equal(chinaDay(after), "2026-11-23");
  const once = grantDailyCoins(empty(), "alice", before);
  assert.equal(grantDailyCoins(once, "alice", before + 1), once);
  const twice = grantDailyCoins(once, "alice", after);
  assert.equal(walletBalance(twice, "alice"), 20);
});

test("tips update ledger, balance and character statistics once without overdrafts", () => {
  const funded = grantDailyCoins(empty(), "alice", now);
  const tipped = tipPerson(funded, "alice", "qin", 3, "tip-one", now);
  assert.equal(walletBalance(tipped, "alice"), 7);
  assert.equal(personStats(tipped, "qin", now).today, 3);
  assert.equal(personStats(tipped, "qin", now).average, null);
  assert.equal(tipPerson(tipped, "alice", "qin", 3, "tip-one", now + 1), tipped);
  for (const amount of [0, -1, 1.5, 8, NaN, Infinity]) assert.throws(() => tipPerson(tipped, "alice", "qin", amount, "bad", now));
  assert.throws(() => tipPerson(tipped, "alice", "zeus", 3, "tip-one", now));
  assert.equal(walletBalance(tipped, "alice"), 7);
  assert.equal(rankPeople(tipped, "total", now)[0].person.id, "qin");
  assert.deepEqual(deserializeContent(JSON.stringify(tipped)), tipped);
});

test("one rating per account can change or be deleted without inflating the vote count", () => {
  let state = saveReview(empty(), "alice", "qin", 5, "有趣", now);
  state = saveReview(state, "alice", "qin", 2, "更新评价", now + 1);
  state = saveReview(state, "bob", "qin", 4, "", now + 2);
  assert.equal(personStats(state, "qin", now).count, 2); assert.equal(personStats(state, "qin", now).average, 3);
  assert.equal(rankPeople(state, "rating", now).length, 0);
  for (let index = 0; index < 3; index++) state = saveReview(state, `reader_${index}`, "qin", 5, "", now);
  assert.equal(rankPeople(state, "rating", now)[0].count, 5);
  const own = state.reviews.find(item => item.handle === "alice");
  assert.throws(() => removeReview(state, "bob", own.id));
  assert.equal(personStats(removeReview(state, "alice", own.id), "qin", now).count, 4);
});

test("valid handles that match Object prototype names do not corrupt recent roles", () => {
  for (const handle of ["constructor", "__proto__"]) {
    const saved = publishPost(empty(), handle, draft("zeus"), "prototype", now);
    assert.deepEqual(saved.state.recentPeople[handle], ["zeus"]);
    assert.doesNotThrow(() => deserializeContent(JSON.stringify(saved.state)));
  }
});

test("corrupt coin and rating data is rejected instead of silently changing balances", () => {
  const funded = grantDailyCoins(empty(), "alice", now);
  assert.throws(() => deserializeContent(JSON.stringify({ ...funded, transactions: [...funded.transactions, ...funded.transactions] })));
  const rated = saveReview(funded, "alice", "qin", 4, "", now);
  assert.throws(() => deserializeContent(JSON.stringify({ ...rated, reviews: [...rated.reviews, ...rated.reviews] })));
});

test("reports are local, login-required, and deduplicated for the same target", () => {
  const saved = post(); const reported = reportContent(saved.state, "bob", "post", saved.id, "其他", now);
  assert.equal(reportContent(reported, "bob", "post", saved.id, "其他", now + 1), reported);
  assert.equal(reported.reports.length, 1);
  assert.throws(() => reportContent(reported, "bob", "post", "missing", "其他", now));
});
