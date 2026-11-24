import assert from "node:assert/strict";
import { test, before, after, beforeEach, afterEach } from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { connect } from "../../scripts/db/common.mjs";

let db;
let ids;
const uuid = () => randomUUID();
const hash = () => randomBytes(32).toString("hex");
async function user(client, handle = `test_${randomBytes(5).toString("hex")}`) {
  const id = uuid();
  await client.query('INSERT INTO inrole.app_users (id,handle,"displayName","updatedAt") VALUES ($1,$2,$3,now())', [id, handle, "测试账号"]);
  return id;
}
async function rejects(sql, values, code) {
  await db.query("SAVEPOINT expected_failure");
  await assert.rejects(db.query(sql, values), error => error.code === code);
  await db.query("ROLLBACK TO SAVEPOINT expected_failure");
}
before(async () => {
  const expected = process.env.INROLE_VERIFY_DATABASE;
  const parsed = new URL(process.env.TEST_DIRECT_URL);
  assert.match(expected ?? "", /^inrole_verify_[a-f0-9]{32}$/);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.equal(parsed.pathname, `/${expected}`);
  db = await connect(process.env.TEST_DIRECT_URL);
});
after(async () => { await db?.end(); });
beforeEach(async () => {
  await db.query("BEGIN");
  ids = { a: await user(db), b: await user(db), post: uuid(), otherPost: uuid(), comment: uuid() };
  await db.query("INSERT INTO inrole.interest_tags (id,name) VALUES ('test','测试分类')");
  await db.query('INSERT INTO inrole.people (id,name,bio,"primaryInterestId","updatedAt") VALUES (\'p1\',\'人物一\',\'简介\',\'test\',now()),(\'p2\',\'人物二\',\'简介\',\'test\',now())');
  await db.query('INSERT INTO inrole.posts (id,"authorId","personId",body,"updatedAt") VALUES ($1,$2,\'p1\',\'正文\',now()),($3,$4,\'p2\',\'原帖\',now())', [ids.post, ids.a, ids.otherPost, ids.b]);
  await db.query('INSERT INTO inrole.comments (id,"postId","authorId","personId",body,"updatedAt") VALUES ($1,$2,$3,\'p2\',\'评论\',now())', [ids.comment, ids.post, ids.b]);
});
afterEach(async () => { await db.query("ROLLBACK"); });

test("handles must be normalized, unique and well formed", async () => {
  for (const value of ["ABc", "ab", "a b", "a".repeat(21)]) await rejects('INSERT INTO inrole.app_users (id,handle,"displayName","updatedAt") VALUES ($1,$2,\'测试\',now())', [uuid(), value], value.length > 20 ? "22001" : "23514");
  const { rows } = await db.query("SELECT handle FROM inrole.app_users WHERE id=$1", [ids.a]);
  await rejects('INSERT INTO inrole.app_users (id,handle,"displayName","updatedAt") VALUES ($1,$2,\'测试\',now())', [uuid(), rows[0].handle], "23505");
});
test("profile and session bounds are enforced", async () => {
  await rejects('UPDATE inrole.app_users SET "displayName"=$1 WHERE id=$2', ["字".repeat(21), ids.a], "23514");
  await rejects('UPDATE inrole.app_users SET "authVersion"=0 WHERE id=$1', [ids.a], "23514");
  await rejects('INSERT INTO inrole.auth_sessions (id,"userId","tokenHash","authVersion","expiresAt") VALUES ($1,$2,$3,1,now()+interval \'8 days\')', [uuid(), ids.a, hash()], "23514");
});
test("post and comment retain actual author, figure and parent", async () => {
  await rejects('UPDATE inrole.posts SET "authorId"=$1 WHERE id=$2', [ids.b, ids.post], "23514");
  await rejects('UPDATE inrole.posts SET "personId"=\'p2\' WHERE id=$1', [ids.post], "23514");
  await rejects('UPDATE inrole.comments SET "postId"=$1 WHERE id=$2', [ids.otherPost, ids.comment], "23514");
  await db.query('UPDATE inrole.posts SET body=\'修改正文\' WHERE id=$1', [ids.post]);
});
test("empty comments and oversized posts are rejected", async () => {
  await rejects('UPDATE inrole.comments SET body=\'  \' WHERE id=$1', [ids.comment], "23514");
  await rejects('UPDATE inrole.posts SET body=$1 WHERE id=$2', ["字".repeat(501), ids.post], "23514");
});
test("likes and reviews are unique per real account", async () => {
  const like = 'INSERT INTO inrole.post_likes ("userId","postId") VALUES ($1,$2)';
  await db.query(like, [ids.a, ids.post]);
  await rejects(like, [ids.a, ids.post], "23505");
  const review = 'INSERT INTO inrole.person_reviews (id,"userId","personId",score,"updatedAt") VALUES ($1,$2,\'p1\',$3,now())';
  await rejects(review, [uuid(), ids.a, 6], "23514");
  await db.query(review, [uuid(), ids.a, 5]);
  await rejects(review, [uuid(), ids.a, 3], "23505");
});
test("missing content references are rejected", async () => {
  await rejects('INSERT INTO inrole.post_likes ("userId","postId") VALUES ($1,$2)', [ids.a, uuid()], "23503");
});
test("reports require exactly one target", async () => {
  await rejects('INSERT INTO inrole.content_reports (id,"reporterId",reason) VALUES ($1,$2,\'理由\')', [uuid(), ids.a], "23514");
  await rejects('INSERT INTO inrole.content_reports (id,"reporterId","postId","commentId",reason) VALUES ($1,$2,$3,$4,\'理由\')', [uuid(), ids.a, ids.post, ids.comment], "23514");
});
test("character requests accept a trusted URL alone, not empty input or an attacker host", async () => {
  const query = 'INSERT INTO inrole.character_requests (id,"userId","dedupeKey","sourceUrl") VALUES ($1,$2,$3,$4)';
  await db.query(query, [uuid(), ids.a, hash(), "https://zh.wikipedia.org/wiki/李白"]);
  await rejects(query, [uuid(), ids.a, hash(), null], "23514");
  await rejects(query, [uuid(), ids.a, hash(), "https://wikipedia.org.evil.example/wiki/x"], "23514");
});
test("wallets cannot become negative and ledger deltas cannot be zero", async () => {
  await db.query('INSERT INTO inrole.wallets ("userId","updatedAt") VALUES ($1,now())', [ids.a]);
  await rejects('UPDATE inrole.wallets SET balance=-1 WHERE "userId"=$1', [ids.a], "23514");
  const operation = uuid();
  await db.query('INSERT INTO inrole.coin_operations (id,kind,"actorId",amount,"grantDay") VALUES ($1,\'DAILY_GRANT\',$2,10,(now() AT TIME ZONE \'Asia/Shanghai\')::date)', [operation, ids.a]);
  await rejects('INSERT INTO inrole.coin_entries (id,"operationId","userId",delta) VALUES ($1,$2,$3,0)', [uuid(), operation, ids.a], "23514");
  await rejects('UPDATE inrole.coin_operations SET amount=20 WHERE id=$1', [operation], "23514");
});
test("daily grants are fixed at ten and unique by account and Beijing date", async () => {
  const grant = 'INSERT INTO inrole.coin_operations (id,kind,"actorId",amount,"grantDay") VALUES ($1,\'DAILY_GRANT\',$2,$3,(now() AT TIME ZONE \'Asia/Shanghai\')::date)';
  await rejects(grant, [uuid(), ids.a, 9], "23514");
  await db.query(grant, [uuid(), ids.a, 10]);
  await rejects(grant, [uuid(), ids.a, 10], "23505");
});
test("self gifts and invalid operation shapes are rejected", async () => {
  const request = uuid();
  await db.query('INSERT INTO inrole.write_requests (id,"userId",scope,key,"payloadHash") VALUES ($1,$2,\'gift\',\'key\',$3)', [request, ids.a, hash()]);
  await rejects('INSERT INTO inrole.coin_operations (id,kind,"actorId","recipientId","postId",amount,"requestId") VALUES ($1,\'POST_GIFT\',$2,$2,$3,1,$4)', [uuid(), ids.a, ids.post, request], "23514");
});
test("poll votes cannot select another poll's option", async () => {
  await db.query('INSERT INTO inrole.polls ("postId",question,"endsAt") VALUES ($1,\'选一个\',now()+interval \'1 day\'),($2,\'另一个\',now()+interval \'3 days\')', [ids.post, ids.otherPost]);
  const option = uuid();
  await db.query('INSERT INTO inrole.poll_options (id,"postId",position,text,"normalizedText") VALUES ($1,$2,0,\'选项\',\'选项\')', [option, ids.otherPost]);
  await rejects('INSERT INTO inrole.poll_votes ("userId","postId","optionId") VALUES ($1,$2,$3)', [ids.a, ids.post, option], "23503");
  await rejects('UPDATE inrole.poll_options SET text=\'修改\' WHERE id=$1', [option], "23514");
});
test("runtime role reads the catalog but cannot run DDL, grant admin or change money", async () => {
  const app = await connect(process.env.TEST_DATABASE_URL);
  try {
    await app.query("BEGIN");
    await app.query("SELECT id,name FROM inrole.people");
    for (const sql of ["CREATE TABLE inrole.unauthorized (id int)", "CREATE TABLE public.unauthorized (id int)", 'UPDATE inrole.app_users SET role=\'ADMIN\'', 'UPDATE inrole.wallets SET balance=1000', 'INSERT INTO inrole.coin_entries (id,"operationId","userId",delta) VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1)']) {
      await app.query("SAVEPOINT denied");
      await assert.rejects(app.query(sql), error => error.code === "42501");
      await app.query("ROLLBACK TO SAVEPOINT denied");
    }
    const account = await user(app);
    await app.query('INSERT INTO inrole.wallets ("userId","updatedAt") VALUES ($1,now())', [account]);
    assert.equal((await app.query('SELECT balance FROM inrole.wallets WHERE "userId"=$1', [account])).rows[0].balance, "0");
  } finally { await app.query("ROLLBACK"); await app.end(); }
});
test("concurrent registrations with the same normalized handle have one winner", async () => {
  const clients = await Promise.all([connect(process.env.TEST_DATABASE_URL), connect(process.env.TEST_DATABASE_URL)]);
  try {
    const handle = `race_${randomBytes(5).toString("hex")}`;
    const outcomes = await Promise.allSettled(clients.map(client => user(client, handle)));
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(outcomes.find(result => result.status === "rejected").reason.code, "23505");
  } finally { await Promise.all(clients.map(client => client.end())); }
});
