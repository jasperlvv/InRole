import assert from "node:assert/strict";
import test from "node:test";
import { createInitialContent, deserializeContent, publishPost, removePost, requestCharacter, voteInPoll } from "../src/lib/content-model.ts";
import { IMAGE_LIMIT, VIDEO_LIMIT, normalizeEncyclopediaUrl, normalizePoll, validateAttachments } from "../src/lib/post-rules.ts";

const now = Date.parse("2026-11-23T02:00:00Z");
const draft = (extras = {}) => ({ personId: "qin", body: "", topicIds: [], ...extras });
const poll = () => ({ question: "周一先做什么？", options: ["开朝会", "先下班"], durationHours: 24 });
const image = () => ({ id: "image-1", kind: "image", mime: "image/png", size: 100, name: "example.png" });

test("rich posts accept media, polls or quotes without a body, preserving actual authors and personas", () => {
  const initial = createInitialContent(now);
  const first = publishPost(initial, "alice", draft({ attachments: [image()], poll: poll(), quotePostId: "post-02" }), "rich", now);
  const saved = first.state.posts[0];
  assert.equal(saved.personId, "qin"); assert.equal(saved.handle, "alice"); assert.equal(saved.quotePostId, "post-02");
  assert.deepEqual(saved.attachments, [image()]); assert.equal(saved.poll.endsAt, now + 86_400_000);
  assert.deepEqual(deserializeContent(JSON.stringify(first.state)), first.state);
  assert.throws(() => publishPost(initial, "alice", draft(), "empty", now));
  assert.throws(() => publishPost(initial, "alice", draft({ quotePostId: "missing" }), "bad", now));
  assert.throws(() => publishPost(initial, null, draft({ poll: poll() }), "guest", now));
});

test("media limits reject unsupported types, invalid sizes, mixed media and duplicate references", () => {
  assert.equal(validateAttachments([{ ...image(), size: IMAGE_LIMIT }]).length, 1);
  for (const bad of [{ ...image(), size: IMAGE_LIMIT + 1 }, { ...image(), mime: "image/svg+xml" }, { ...image(), size: -1 }, { ...image(), kind: "audio" }, { ...image(), id: "../escape" }]) assert.throws(() => validateAttachments([bad]));
  assert.throws(() => validateAttachments([image(), image()]));
  assert.throws(() => validateAttachments(Array.from({ length: 7 }, (_, index) => ({ ...image(), id: `image-${index}` }))));
  const video = { id: "video-1", kind: "video", name: "clip.mp4", mime: "video/mp4", size: VIDEO_LIMIT };
  assert.doesNotThrow(() => validateAttachments([video]));
  assert.throws(() => validateAttachments([{ ...video, size: VIDEO_LIMIT + 1 }]));
  assert.throws(() => validateAttachments([video, image()]));
});

test("poll options and durations are validated, normalized and never duplicated", () => {
  assert.deepEqual(normalizePoll({ ...poll(), question: " 问题 ", options: [" A ", "B"] }).options, ["A", "B"]);
  for (const patch of [{ question: " " }, { options: ["a", " A "] }, { options: ["a"] }, { options: ["a", " "] }, { options: ["a", "b", "c", "d", "e"] }, { durationHours: 0 }, { question: "🦊".repeat(101) }]) assert.throws(() => normalizePoll({ ...poll(), ...patch }));
});

test("poll votes are per account, idempotent, expired-safe and removed with their own post", () => {
  const made = publishPost(createInitialContent(now), "alice", draft({ poll: poll() }), "poll", now);
  const options = made.state.posts[0].poll.options;
  const voted = voteInPoll(made.state, "bob", made.id, options[0].id, now + 1);
  assert.equal(voteInPoll(voted, "bob", made.id, options[0].id, now + 2), voted);
  assert.throws(() => voteInPoll(voted, "bob", made.id, options[1].id, now + 3));
  assert.throws(() => voteInPoll(voted, null, made.id, options[1].id, now + 3));
  assert.throws(() => voteInPoll(voted, "charlie", made.id, options[0].id, now + 86_400_000));
  assert.throws(() => voteInPoll(voted, "charlie", made.id, "other", now + 1));
  assert.deepEqual(deserializeContent(JSON.stringify(voted)), voted);
  assert.throws(() => deserializeContent(JSON.stringify({ ...voted, pollVotes: [...voted.pollVotes, ...voted.pollVotes] })));
  assert.equal(removePost(voted, "alice", made.id).pollVotes.length, 0);
});

test("character proposals accept manual data or encyclopedia URL only, dedupe per author and remain pending", () => {
  const initial = createInitialContent(now);
  const manual = requestCharacter(initial, "alice", { name: " 辛弃疾 ", bio: "南宋词人", sourceUrl: "" }, "first", now);
  assert.equal(manual.state.characterRequests[0].name, "辛弃疾");
  assert.equal(manual.state.characterRequests[0].status, "pending");
  assert.equal(manual.state.posts, initial.posts);
  assert.equal(requestCharacter(manual.state, "alice", { name: "辛弃疾", bio: "另一段资料", sourceUrl: "" }, "second", now).state, manual.state);
  const link = requestCharacter(manual.state, "alice", { name: "", bio: "", sourceUrl: "https://zh.wikipedia.org/wiki/Apollo?test=1#section" }, "url", now);
  assert.equal(link.state.characterRequests[1].sourceUrl, "https://zh.wikipedia.org/wiki/Apollo");
  assert.deepEqual(deserializeContent(JSON.stringify(link.state)), link.state);
  for (const data of [{ name: "", bio: "资料", sourceUrl: "" }, { name: "某人", bio: "", sourceUrl: "" }, { name: "秦始皇", bio: "已存在", sourceUrl: "" }]) assert.throws(() => requestCharacter(initial, "alice", data, "bad", now));
  assert.throws(() => requestCharacter(initial, null, { name: "某人", bio: "资料", sourceUrl: "" }, "guest", now));
});

test("encyclopedia URLs use exact trusted hosts and entry paths without fetching user-provided URLs", () => {
  assert.equal(normalizeEncyclopediaUrl("https://baike.baidu.com/item/Apollo/123?from=1"), "https://baike.baidu.com/item/Apollo/123");
  assert.equal(normalizeEncyclopediaUrl("https://zh.m.wikipedia.org/wiki/Apollo"), "https://zh.m.wikipedia.org/wiki/Apollo");
  for (const url of ["javascript:alert(1)", "https://evil.test/wiki/A", "https://wikipedia.org.evil.test/wiki/A", "https://zh.wikipedia.org@evil.test/wiki/A", "https://u:p@zh.wikipedia.org/wiki/A", "http://zh.wikipedia.org/wiki/A", "https://baike.baidu.com/", "https://zh.wikipedia.org/wiki/"]) assert.throws(() => normalizeEncyclopediaUrl(url));
});

test("older saved state upgrades without erasing posts, wallet or reviews; deleted quotes reveal no copied body", () => {
  const initial = createInitialContent(now); const old = { ...initial }; delete old.pollVotes; delete old.characterRequests;
  const loaded = deserializeContent(JSON.stringify(old));
  assert.deepEqual(loaded.posts, initial.posts); assert.deepEqual(loaded.transactions, initial.transactions); assert.deepEqual(loaded.pollVotes, []);
  const quote = publishPost(loaded, "alice", draft({ quotePostId: "post-01" }), "quote", now);
  const removed = removePost(quote.state, "xiaowang", "post-01");
  const own = removed.posts.find((post) => post.id === quote.id);
  assert.equal(own.quotePostId, "post-01"); assert.equal(own.body, "");
  assert.doesNotThrow(() => deserializeContent(JSON.stringify(removed)));
});
