import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialContent, publishPost, removePost, giftPostAuthor, grantDailyCoins,
  walletBalance, transactionDelta, postStats, personStats, tipPerson, deserializeContent,
} from "../src/lib/content-model.ts";

const now = Date.parse("2026-11-23T06:00:00Z");
function setup() {
  const initial = createInitialContent(now);
  const first = publishPost(initial, "alice", { personId: "qin", body: "第一位贴主", topicIds: [] }, "alice-post", now);
  const second = publishPost(first.state, "charlie", { personId: "qin", body: "同一人物，另一位贴主", topicIds: [] }, "charlie-post", now);
  return { state: grantDailyCoins(second.state, "bob", now), firstId: first.id, secondId: second.id };
}

test("Tongbao gifts debit and credit actual authors atomically, independent of the public character", () => {
  const { state, firstId, secondId } = setup();
  const characterBefore = personStats(state, "qin", now);
  const once = giftPostAuthor(state, "bob", firstId, 3, "gift-one", now + 1);
  const twice = giftPostAuthor(once, "bob", secondId, 2, "gift-two", now + 2);
  assert.equal(walletBalance(twice, "bob"), 5);
  assert.equal(walletBalance(twice, "alice"), 3);
  assert.equal(walletBalance(twice, "charlie"), 2);
  assert.equal(walletBalance(state, "bob"), 10);
  assert.equal(twice.transactions.length, state.transactions.length + 2);
  assert.equal(postStats(twice, firstId, "bob").gifts, 3);
  assert.equal(postStats(twice, secondId, "bob").gifts, 2);
  assert.equal(postStats(twice, firstId, "bob").gifted, true);
  assert.equal(postStats(twice, firstId, "alice").gifted, false);
  const gift = twice.transactions.find((item) => item.kind === "gift");
  assert.equal(transactionDelta(gift, "bob"), -3);
  assert.equal(transactionDelta(gift, "alice"), 3);
  assert.equal(transactionDelta(gift, "unrelated"), 0);
  assert.deepEqual(personStats(twice, "qin", now), characterBefore);
  assert.deepEqual(deserializeContent(JSON.stringify(twice)), twice);
});

test("gifts reject guests, self support, invalid amounts, missing posts and insufficient funds without mutation", () => {
  const { state, firstId } = setup();
  const original = JSON.stringify(state);
  for (const actor of [null, "", "INVALID", "a"]) assert.throws(() => giftPostAuthor(state, actor, firstId, 1, "request", now));
  assert.throws(() => giftPostAuthor(state, "alice", firstId, 1, "self", now));
  assert.throws(() => giftPostAuthor(state, "bob", "missing", 1, "missing", now));
  for (const amount of [0, -1, 1.5, 11, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => giftPostAuthor(state, "bob", firstId, amount, "amount", now));
  for (const key of ["", null, "with spaces", "a".repeat(101)]) assert.throws(() => giftPostAuthor(state, "bob", firstId, 1, key, now));
  for (const time of [NaN, Infinity, 0, now - 1]) assert.throws(() => giftPostAuthor(state, "bob", firstId, 1, "time", time));
  assert.equal(JSON.stringify(state), original);
});

test("gift retries are idempotent and two sequential large gifts cannot overdraw the wallet", () => {
  const { state, firstId, secondId } = setup();
  const sent = giftPostAuthor(state, "bob", firstId, 8, "same-request", now);
  assert.equal(giftPostAuthor(sent, "bob", firstId, 8, "same-request", now + 1), sent);
  assert.throws(() => giftPostAuthor(sent, "bob", firstId, 1, "same-request", now));
  assert.throws(() => giftPostAuthor(sent, "bob", secondId, 8, "same-request", now));
  assert.throws(() => giftPostAuthor(sent, "bob", secondId, 8, "another-request", now));
  assert.equal(walletBalance(sent, "bob"), 2);
  assert.equal(walletBalance(sent, "alice"), 8);
  assert.equal(grantDailyCoins(sent, "bob", now), sent);
});

test("deleted posts retain settled gifts and their retry identity across storage round trips", () => {
  const { state, firstId } = setup();
  const sent = giftPostAuthor(state, "bob", firstId, 3, "settled", now);
  const removed = removePost(sent, "alice", firstId);
  const restored = deserializeContent(JSON.stringify(removed));
  assert.equal(walletBalance(restored, "bob"), 7);
  assert.equal(walletBalance(restored, "alice"), 3);
  assert.equal(giftPostAuthor(restored, "bob", firstId, 3, "settled", now + 1), restored);
  assert.throws(() => giftPostAuthor(restored, "bob", firstId, 1, "new-request", now + 1));
});

test("received Tongbao can support another author or a character without minting an extra daily grant", () => {
  const { state, firstId, secondId } = setup();
  const sent = giftPostAuthor(state, "bob", firstId, 6, "first-gift", now);
  const passed = giftPostAuthor(sent, "alice", secondId, 2, "pass-on", now);
  const tipped = tipPerson(passed, "alice", "qin", 1, "character-support", now);
  assert.equal(walletBalance(tipped, "bob"), 4);
  assert.equal(walletBalance(tipped, "alice"), 3);
  assert.equal(walletBalance(tipped, "charlie"), 2);
  assert.equal(personStats(tipped, "qin", now).total, personStats(state, "qin", now).total + 1);
  const claimed = grantDailyCoins(tipped, "alice", now);
  assert.equal(walletBalance(claimed, "alice"), 13);
  assert.equal(grantDailyCoins(claimed, "alice", now), claimed);
  assert.deepEqual(deserializeContent(JSON.stringify(claimed)), claimed);
});

test("legacy wallets remain valid and malformed gift records are rejected rather than changing balances", () => {
  const { state, firstId } = setup();
  assert.deepEqual(deserializeContent(JSON.stringify(state)), state);
  const sent = giftPostAuthor(state, "bob", firstId, 3, "checked", now);
  for (const patch of [{ recipientHandle: "bob" }, { recipientHandle: "mallory" }, { recipientHandle: "bad name" }, { amount: 100 }, { postId: "../bad" }, { personId: "qin" }, { requestKey: "" }, { kind: "grant" }, { id: "mismatched-id" }]) {
    const invalid = { ...sent, transactions: sent.transactions.map((item) => item.kind === "gift" ? { ...item, ...patch } : item) };
    assert.throws(() => deserializeContent(JSON.stringify(invalid)));
  }
  const gift = sent.transactions.find((item) => item.kind === "gift");
  assert.throws(() => deserializeContent(JSON.stringify({ ...sent, transactions: [...sent.transactions, gift] })));
});
