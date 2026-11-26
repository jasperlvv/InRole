import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import sharp from "sharp";
import http from "node:http";
import { databaseFaultProxy } from "./fault-proxy.mjs";
import { root, state, databaseUrl, connect, migrate, permissions, redact, fail } from "./common.mjs";

const trustedOrigin = "https://inrole.test", sessionKey = randomBytes(48).toString("base64url"), rateKey = randomBytes(48).toString("base64url"), recoveryKey = randomBytes(48).toString("base64url");
const results = [], servers = [], password = randomBytes(24).toString("base64url"), mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inrole-media-test-"));
let bootstrap, owner, application, database, created = false, faultProxy, droppedResponseProxy;
async function start(url) {
  const socket = createServer(); await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const server = { origin: `http://127.0.0.1:${port}`, logs: "", child: null };
  server.child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production", DATABASE_URL: url, SESSION_PASSWORD: sessionKey, RATE_LIMIT_SECRET: rateKey, RECOVERY_CODE_PEPPER: recoveryKey, APP_ORIGIN: trustedOrigin, TRUSTED_CLIENT_IP_HEADER: "", MEDIA_STORAGE_ROOT: mediaRoot, ERASURE_RECEIPT_DIR: path.join(mediaRoot,".receipts") } });
  servers.push(server); for (const stream of [server.child.stdout, server.child.stderr]) stream.on("data", chunk => { server.logs += redact(chunk); });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(server.origin + "/live/login")).status === 200) return server.origin; } catch {} await delay(200); }
  throw new Error("Production verification server did not start");
}
async function request(origin, resource, { method = "GET", data, cookie, status = 200, key, headers = {}, raw } = {}) {
  const response = await fetch(origin + resource, { method, headers: { Origin: trustedOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}), ...headers }, body: raw ?? (data !== undefined ? JSON.stringify(data) : undefined), signal: AbortSignal.timeout(20000) });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { throw new Error(`Invalid JSON ${resource} ${response.status}`); }
  assert.equal(response.status, status, `${method} ${resource}: ${text}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.ok, status < 400); assert.ok(!/passwordHash|tokenHash|authVersion|postgresql:\/\//.test(text));
  return { data: body.data, meta: body.meta, cookie: (response.headers.get("set-cookie") || "").split(";")[0] };
}
const call = (origin, path, options = {}) => request(origin, `/api/v1/community/${path}`, options);
async function scenario(name, action) { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
try {
  const config = await state(); bootstrap = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  database = `inrole_verify_${randomUUID().replaceAll("-", "")}`;
  await bootstrap.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`); created = true;
  await bootstrap.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`); await bootstrap.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
  const direct = databaseUrl(config, database, "inrole_migrator"), app = databaseUrl(config, database, "inrole_app");
  owner = await connect(direct); await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC"); await migrate(direct); await permissions(direct); application = await connect(app);
  const catalog = JSON.parse(await fs.readFile(path.join(root, "prisma/catalog.json"), "utf8"));
  for (const tag of catalog.interests) await owner.query("INSERT INTO inrole.interest_tags(id,name) VALUES($1,$2)", [tag.id, tag.name]);
  for (const person of catalog.people) await owner.query('INSERT INTO inrole.people(id,name,bio,"primaryInterestId","legacyAvatarPath","updatedAt") VALUES($1,$2,$3,$4,$5,now())', [person.id, person.name, person.bio, person.primaryInterestId, person.legacyAvatarPath]);
  for (const topic of catalog.topics) { await owner.query('INSERT INTO inrole.topics(id,name,description) VALUES($1,$2,$3)', [topic.id, topic.name, topic.description]); await owner.query('INSERT INTO inrole.topic_interests("topicId","interestId") VALUES($1,$2)', [topic.id, topic.interestId]); }
  const first = await start(app), second = await start(app), accounts = [];
  for (const handle of ["actor_a", "actor_b", "actor_c", "actor_d", "actor_e", "moderator"]) {
    const signup = await request(first, "/api/v1/auth/register", { method: "POST", data: { handle, password }, status: 201 });
    const user = (await owner.query("SELECT id FROM inrole.app_users WHERE handle=$1", [handle])).rows[0]; accounts.push({ ...user, handle, cookie: signup.cookie });
  }
  const [a, b, c, d, e, moderator] = accounts;
  const create = (who, data, key = randomUUID(), origin = first) => call(origin, "posts", { method: "POST", cookie: who.cookie, data: { personId: "libai", body: "真实故事", ...data }, key, status: 201 });
  let post, otherPost, quote, image, comment, report;
  await scenario("guests and bad origins cannot write or read private resources", async () => {
    for (const endpoint of ["preferences", "wallet", "activity", "admin"]) await call(first, endpoint, { status: 401 });
    for (const endpoint of ["posts", "claim", "requests", "reports", "admin"]) await call(first, endpoint, { method: "POST", data: {}, key: randomUUID(), status: 401 });
    await call(first, "claim", { method: "POST", cookie: a.cookie, data: {}, headers: { Origin: "https://attacker.test" }, status: 403 });
    await call(first, "catalog", { method: "POST", cookie: a.cookie, data: {}, status: 405 });
  });
  await scenario("onboarding gates interactions and supports partial save, resume and skip", async () => {
    await call(first, "posts", { method: "POST", cookie: a.cookie, data: { personId: "libai", body: "blocked" }, key: randomUUID(), status: 409 });
    await call(first, "preferences", { method: "PUT", cookie: a.cookie, data: { interestIds: ["science"], finishOnboarding: false } });
    assert.deepEqual((await call(second, "preferences", { cookie: a.cookie })).data.interestIds, ["science"]);
    assert.equal((await call(second, "preferences", { cookie: a.cookie })).data.onboardingComplete, false);
    await call(first, "preferences", { method: "PUT", cookie: a.cookie, data: { interestIds: ["science"], finishOnboarding: true } });
    for (const who of accounts.slice(1)) await call(first, "preferences", { method: "PUT", cookie: who.cookie, data: { interestIds: [], finishOnboarding: true } });
    await call(first, "preferences", { method: "PUT", cookie: a.cookie, data: { interestIds: ["science", "science"], finishOnboarding: true }, status: 400 });
    await call(first, "preferences", { method: "PUT", cookie: a.cookie, data: { interestIds: ["not-real"], finishOnboarding: true }, status: 409 });
    assert.equal((await call(first, "catalog")).data.interests.length, 9);
  });
  await scenario("post idempotency, author isolation and historical character identity", async () => {
    const key = randomUUID(); post = (await create(a, { body: "李白先开口", topicIds: ["poetry"] }, key)).data;
    assert.equal((await create(a, { body: "李白先开口", topicIds: ["poetry"] }, key, second)).data.id, post.id);
    await call(first, "posts", { method: "POST", cookie: a.cookie, data: { personId: "libai", body: "different" }, key, status: 409 });
    otherPost = (await create(b, { personId: "newton", body: "科学发现", topicIds: ["today"] })).data;
    assert.equal((await call(first, `posts/${post.id}`)).data.person.id, "libai");
    await call(first, `posts/${post.id}`, { method: "DELETE", cookie: b.cookie, data: {}, status: 403 });
    await call(first, "posts", { method: "POST", cookie: a.cookie, key: randomUUID(), data: { personId: "libai", body: "forged", authorId: b.id }, status: 400 });
  });
  await scenario("comments use independent characters and are idempotent and private to their author for deletion", async () => {
    const key = randomUUID(), data = { personId: "wukong", body: "孙悟空接话" };
    comment = (await call(first, `posts/${post.id}/comments`, { method: "POST", cookie: b.cookie, data, key, status: 201 })).data;
    assert.equal((await call(second, `posts/${post.id}/comments`, { method: "POST", cookie: b.cookie, data, key, status: 201 })).data.id, comment.id);
    const list = (await call(first, `posts/${post.id}/comments`)).data;
    assert.equal(list.length, 1); assert.equal(list[0].person.id, "wukong"); assert.equal(list[0].author.handle, b.handle);
    await call(first, `comments/${comment.id}`, { method: "DELETE", cookie: a.cookie, data: {}, status: 403 });
  });
  await scenario("likes are account-unique, reversible and reject nonboolean state", async () => {
    for (const origin of [first, second]) await call(origin, `posts/${post.id}/like`, { method: "PUT", cookie: b.cookie, data: { liked: true } });
    assert.equal((await call(first, `posts/${post.id}`)).data.likes, 1);
    await call(first, `posts/${post.id}/like`, { method: "PUT", cookie: b.cookie, data: { liked: false } });
    assert.equal((await call(first, `posts/${post.id}`)).data.likes, 0);
    await call(first, `posts/${post.id}/like`, { method: "PUT", cookie: b.cookie, data: { liked: "true" }, status: 400 });
    await call(first, `posts/${post.id}/like`, { method: "PUT", cookie: b.cookie, data: { liked: true } });
  });
  await scenario("pagination is stable, filter-bound and search uses actual database content", async () => {
    const page = await call(first, "posts?limit=1"); assert.equal(page.data.length, 1); assert.equal(page.meta.page.hasMore, true);
    const next = await call(first, `posts?limit=1&cursor=${page.meta.page.nextCursor}`); assert.notEqual(next.data[0].id, page.data[0].id);
    await call(first, `posts?person=libai&cursor=${page.meta.page.nextCursor}`, { status: 400 });
    assert.equal((await call(first, "posts?q=科学发现")).data[0].id, otherPost.id);
    await call(first, "posts?limit=99", { status: 400 });
  });
  await scenario("poll options seal on publish; one account has one vote and expiration is enforced", async () => {
    const poll = (await create(a, { body: "", poll: { question: "选一个", options: ["甲", "乙"], durationDays: 1 } })).data;
    const data = (await call(first, `posts/${poll.id}`)).data;
    await call(first, `posts/${poll.id}/vote`, { method: "POST", cookie: b.cookie, data: { optionId: data.poll.options[0].id } });
    await call(second, `posts/${poll.id}/vote`, { method: "POST", cookie: b.cookie, data: { optionId: data.poll.options[0].id } });
    await call(first, `posts/${poll.id}/vote`, { method: "POST", cookie: b.cookie, data: { optionId: data.poll.options[1].id }, status: 409 });
    assert.equal((await call(first, `posts/${poll.id}`)).data.poll.totalVotes, 1);
    await assert.rejects(application.query('INSERT INTO inrole.poll_options(id,"postId",position,text,"normalizedText") VALUES($1,$2,2,\'丙\',\'丙\')', [randomUUID(), poll.id]), error => error.code === "23514");
    await owner.query("BEGIN");
    await owner.query("ALTER TABLE inrole.polls DISABLE TRIGGER polls_seal_guard");
    await owner.query('UPDATE inrole.polls SET "createdAt"=now()-interval \'2 days\',"endsAt"=now()-interval \'1 day\' WHERE "postId"=$1', [poll.id]);
    await owner.query("SET CONSTRAINTS ALL IMMEDIATE");
    await owner.query("ALTER TABLE inrole.polls ENABLE TRIGGER polls_seal_guard");
    await owner.query("COMMIT");
    await call(first, `posts/${poll.id}/vote`, { method: "POST", cookie: c.cookie, data: { optionId: data.poll.options[0].id }, status: 409 });
    await create(a, { body: "invalid", poll: { question: "x", options: ["a", "b"], durationDays: 1 } });
    await call(first, "posts", { method: "POST", cookie: a.cookie, key: randomUUID(), data: { personId: "libai", body: "", poll: { question: "x", options: ["a", "a"], durationDays: 1 } }, status: 400 });
  });
  await scenario("rating edits do not add voters; deletion and 5-voter threshold are correct", async () => {
    for (const [who, score] of [[a, 2], [b, 4]]) await call(first, "people/libai/review", { method: "PUT", cookie: who.cookie, data: { score, body: "真实评价" } });
    const data = (await call(first, "people/libai/reviews")).data; assert.equal(data.average, 3); assert.equal(data.count, 2);
    assert.equal((await call(first, "rankings")).data.length, 0);
    await call(first, "people/libai/review", { method: "PUT", cookie: a.cookie, data: { score: 5, body: "修改" } });
    assert.equal((await call(first, "people/libai/reviews")).data.count, 2);
    for (const who of [c, d, e]) await call(first, "people/libai/review", { method: "PUT", cookie: who.cookie, data: { score: 3 } });
    assert.equal((await call(first, "rankings")).data[0].count, 5);
    await call(first, "people/libai/review", { method: "DELETE", cookie: a.cookie, data: {} });
    assert.equal((await call(first, "people/libai/reviews")).data.count, 4);
  });
  await scenario("concurrent daily claims across instances grant exactly ten for Beijing date", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => call(i % 2 ? first : second, "claim", { method: "POST", cookie: a.cookie, data: {} })));
    assert.equal((await call(first, "wallet", { cookie: a.cookie })).data.balance, "10");
    const grant = (await owner.query('SELECT count(*)::integer AS count,min("grantDay")::text AS day FROM inrole.coin_operations WHERE "actorId"=$1', [a.id])).rows[0]; assert.equal(grant.count, 1);
    assert.equal(grant.day, (await call(first, "wallet", { cookie: a.cookie })).data.day);
  });
  await scenario("concurrent 8+8 spending from ten allows one success and preserves two", async () => {
    const responses = await Promise.all([first, second].map(origin => fetch(origin + "/api/v1/community/people/libai/tip", { method: "POST", headers: { Origin: trustedOrigin, Cookie: a.cookie, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ amount: 8 }) })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal((await call(first, "wallet", { cookie: a.cookie })).data.balance, "2");
    assert.equal((await call(first, "coins/all")).data[0].amount, "8");
  });
  await scenario("post gifts atomically transfer to real author, prevent self gifts and deduplicate retries", async () => {
    const key = randomUUID();
    const firstGift = await call(first, `posts/${otherPost.id}/gift`, { method: "POST", cookie: a.cookie, data: { amount: 2 }, key });
    const retry = await call(second, `posts/${otherPost.id}/gift`, { method: "POST", cookie: a.cookie, data: { amount: 2 }, key }); assert.equal(firstGift.data.id, retry.data.id);
    assert.equal((await call(first, "wallet", { cookie: a.cookie })).data.balance, "0");
    assert.equal((await call(first, "wallet", { cookie: b.cookie })).data.balance, "12");
    assert.equal((await call(first, `posts/${otherPost.id}`)).data.receivedCoins, "2");
    const wallet = (await call(first, "wallet", { cookie: b.cookie })).data;
    assert.equal(wallet.totals.received, "2"); assert.equal(wallet.totals.grants, "10");
    const own = (await call(first, "activity", { cookie: b.cookie })).data;
    assert.ok(own.postCards.some(row => row.id === otherPost.id)); assert.ok(own.likedPosts.some(row => row.id === post.id));
    await call(first, `posts/${otherPost.id}/gift`, { method: "POST", cookie: a.cookie, data: { amount: 1 }, key, status: 409 });
    await call(first, `posts/${otherPost.id}/gift`, { method: "POST", cookie: b.cookie, data: { amount: 1 }, key: randomUUID(), status: 409 });
    await call(first, "wallet?userId=" + b.id, { cookie: a.cookie, status: 400 });
    const mismatch = (await owner.query('SELECT w."userId" FROM inrole.wallets w LEFT JOIN inrole.coin_entries e ON e."userId"=w."userId" GROUP BY w."userId",w.balance HAVING w.balance<>coalesce(sum(e.delta),0)')).rows; assert.equal(mismatch.length, 0);
    await assert.rejects(application.query('UPDATE inrole.wallets SET balance=100 WHERE "userId"=$1', [a.id]), error => error.code === "42501");
  });
  await scenario("ledger insert failure rolls back balances, operation and idempotency record together", async () => {
    const key = randomUUID();
    await owner.query("CREATE FUNCTION inrole.test_ledger_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delta<0 THEN RAISE EXCEPTION 'Test-only ledger failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_ledger_failure BEFORE INSERT ON inrole.coin_entries FOR EACH ROW EXECUTE FUNCTION inrole.test_ledger_failure()");
    await call(first, "people/newton/tip", { method: "POST", cookie: d.cookie, data: { amount: 1 }, key, status: 500 });
    assert.equal((await call(first, "wallet", { cookie: d.cookie })).data.balance, "10");
    assert.equal((await owner.query('SELECT count(*)::integer AS count FROM inrole.write_requests WHERE "userId"=$1 AND key=$2', [d.id, key])).rows[0].count, 0);
    assert.equal((await owner.query('SELECT count(*)::integer AS count FROM inrole.coin_operations WHERE "actorId"=$1 AND kind<>\'DAILY_GRANT\'', [d.id])).rows[0].count, 0);
    await owner.query("DROP TRIGGER test_ledger_failure ON inrole.coin_entries; DROP FUNCTION inrole.test_ledger_failure()");
    await call(second, "people/newton/tip", { method: "POST", cookie: d.cookie, data: { amount: 1 }, key });
    assert.equal((await call(first, "wallet", { cookie: d.cookie })).data.balance, "9");
    assert.equal((await call(first, "people/newton/coins")).data.total, "1");
  });
  await scenario("hot rankings deduplicate commenters and exclude self interactions and old activity", async () => {
    await call(first, `posts/${post.id}/like`, { method: "PUT", cookie: a.cookie, data: { liked: true } });
    await call(first, `posts/${post.id}/comments`, { method: "POST", cookie: b.cookie, data: { personId: "libai", body: "同账号再次评论" }, key: randomUUID(), status: 201 });
    const trending = (await call(first, "trending")).data;
    assert.equal(trending.posts.find(row => row.post.id === post.id).score, 4);
    assert.equal(trending.topics.find(row => row.id === "poetry").score, 6);
    await owner.query('UPDATE inrole.post_likes SET "createdAt"=now()-interval \'2 days\' WHERE "postId"=$1 AND "userId"=$2', [post.id, b.id]);
    assert.equal((await call(first, "trending")).data.posts.find(row => row.post.id === post.id).score, 3);
    assert.equal((await call(first, "trending?window=7d")).data.posts.find(row => row.post.id === post.id).score, 4);
  });
  await scenario("recommendation changes with interests, has guest fallback and version metadata", async () => {
    const science = (await call(first, "feed", { cookie: a.cookie })).data;
    assert.equal(science.posts[0].id, otherPost.id); assert.equal(science.algorithmVersion, "interest-fresh-heat-v1");
    assert.ok((await call(first, "feed")).data.posts.length > 0);
    await call(first, "preferences", { method: "PUT", cookie: a.cookie, data: { interestIds: ["literature"], finishOnboarding: true } });
    assert.notEqual((await call(first, "feed", { cookie: a.cookie })).data.posts[0].id, otherPost.id);
  });
  await scenario("image uploads decode safely, reject forgery and remain owner-only until published", async () => {
    const data = new FormData(); data.append("file", new Blob([await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer()], { type: "image/png" }), "test.png");
    image = (await call(first, "media", { method: "POST", cookie: b.cookie, raw: data, status: 201 })).data;
    assert.equal((await fetch(first + image.url)).status, 404);
    assert.equal((await fetch(first + image.url, { headers: { Cookie: b.cookie } })).status, 200);
    await call(first, "posts", { method: "POST", cookie: a.cookie, data: { personId: "libai", body: "steal", mediaIds: [image.id] }, key: randomUUID(), status: 409 });
    image.post = (await create(b, { body: "", mediaIds: [image.id] })).data.id;
    assert.equal((await fetch(first + image.url)).status, 200);
    const invalid = new FormData(); invalid.append("file", new Blob(["<svg>invalid</svg>"], { type: "image/png" }), "fake.png");
    await call(first, "media", { method: "POST", cookie: b.cookie, raw: invalid, status: 415 });
  });
  await scenario("ordinary users cannot use management; requests and reports reach the review queue", async () => {
    await call(first, "admin", { cookie: a.cookie, status: 403 });
    await call(first, "admin", { method: "POST", cookie: a.cookie, data: { action: "user.status", targetId: b.id, reason: "test", value: { status: "BANNED" } }, status: 403 });
    const data = { name: "新人物", bio: "供大家选择的公共人物", sourceUrl: "" };
    const r = await call(first, "requests", { method: "POST", cookie: b.cookie, data, status: 201 });
    assert.equal((await call(second, "requests", { method: "POST", cookie: b.cookie, data, status: 201 })).data.id, r.data.id);
    await call(first, "requests", { method: "POST", cookie: b.cookie, data: { sourceUrl: "https://wikipedia.org.evil.test/wiki/x" }, status: 400 });
    report = (await call(first, "reports", { method: "POST", cookie: b.cookie, data: { kind: "post", targetId: post.id, reason: "测试举报" }, key: randomUUID(), status: 201 })).data;
    await owner.query("UPDATE inrole.app_users SET role='ADMIN' WHERE id=$1", [moderator.id]);
    const dashboard = (await call(first, "admin", { cookie: moderator.cookie })).data; assert.equal(dashboard.requests.length, 1); assert.equal(dashboard.reports[0].id, report.id);
  });
  const admin = (action, targetId, value) => call(first, "admin", { method: "POST", cookie: moderator.cookie, data: { action, targetId, reason: "集成验收", value } });
  await scenario("audit failure rolls back moderation and ordinary actors cannot forge a manager", async () => {
    await owner.query("CREATE FUNCTION inrole.test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test-only audit failure'; END $$; CREATE TRIGGER test_audit_failure BEFORE INSERT ON inrole.moderation_actions FOR EACH ROW EXECUTE FUNCTION inrole.test_audit_failure()");
    await call(first, "admin", { method: "POST", cookie: moderator.cookie, data: { action: "topic.save", targetId: "audit-rollback", reason: "test", value: { name: "回滚话题", description: "must roll back", active: true } }, status: 500 });
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM inrole.topics WHERE id='audit-rollback'")).rows[0].count, 0);
    await owner.query("DROP TRIGGER test_audit_failure ON inrole.moderation_actions; DROP FUNCTION inrole.test_audit_failure()");
    await call(first, "admin", { method: "POST", cookie: a.cookie, headers: { "X-User-Id": moderator.id }, data: { action: "topic.save", targetId: "forged-topic", reason: "test", value: { name: "伪造", description: "no", active: true } }, status: 403 });
  });
  await scenario("admin maintains public people/topics and audits application approvals", async () => {
    await admin("person.save", "new-person", { name: "新人物", bio: "公共人物简介", interestId: "science", active: true });
    await admin("topic.save", "new-topic", { name: "新话题", description: "真实话题", active: true });
    const pending = (await call(first, "admin", { cookie: moderator.cookie })).data.requests[0];
    await admin("request.review", pending.id, { approved: true, personId: "new-person" });
    assert.equal((await call(first, "activity", { cookie: b.cookie })).data.requests[0].status, "APPROVED");
    assert.ok((await request(first, "/api/v1/people/new-person")).data.name);
  });
  await scenario("admin avatar upload preserves attribution and ordinary users cannot replace public portraits", async () => {
    const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: "blue" } }).png().toBuffer();
    const make = () => { const data = new FormData(); data.append("file", new Blob([bytes], { type: "image/png" }), "avatar.png"); data.append("purpose", "PERSON_AVATAR"); return data; };
    await call(first, "media", { method: "POST", cookie: a.cookie, raw: make(), status: 403 });
    const avatar = (await call(first, "media", { method: "POST", cookie: moderator.cookie, raw: make(), status: 201 })).data;
    await admin("person.avatar", "new-person", { mediaId: avatar.id, sourceUrl: "https://example.com/original", sourceAuthor: "Generated test fixture", license: "Test-only original image" });
    assert.equal((await request(first, "/api/v1/people/new-person")).data.avatarUrl, avatar.url);
    assert.equal((await fetch(first + avatar.url)).status, 200);
  });
  await scenario("valid MP4 is probed and served with ranges; forgery and mixed attachments are rejected", async () => {
    const data = new FormData(), bytes = await fs.readFile(path.join(root, "tests/fixtures/one-second.mp4"));
    data.append("file", new Blob([bytes], { type: "video/mp4" }), "one-second.mp4");
    const video = (await call(first, "media", { method: "POST", cookie: c.cookie, raw: data, status: 201 })).data;
    assert.equal(video.kind, "video"); assert.equal(video.width, 32);
    const picture = new FormData(); picture.append("file", new Blob([await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer()], { type: "image/png" }), "mixed.png");
    const pictureId = (await call(first, "media", { method: "POST", cookie: c.cookie, raw: picture, status: 201 })).data.id;
    await call(first, "posts", { method: "POST", cookie: c.cookie, data: { personId: "libai", body: "mixed", mediaIds: [video.id, pictureId] }, key: randomUUID(), status: 400 });
    await create(c, { body: "", mediaIds: [video.id] });
    const partial = await fetch(first + video.url, { headers: { Range: "bytes=0-31" } }); assert.equal(partial.status, 206); assert.equal((await partial.arrayBuffer()).byteLength, 32);
    assert.equal((await fetch(first + video.url, { headers: { Range: "bytes=999999999-" } })).status, 416);
    const invalid = new FormData(); invalid.append("file", new Blob(["not-a-video"], { type: "video/mp4" }), "fake.mp4");
    await call(first, "media", { method: "POST", cookie: c.cookie, raw: invalid, status: 415 });
  });
  await scenario("recovery codes are hashed, single-use, work across instances and revoke old sessions", async () => {
    const generated = await request(first, "/api/v1/auth/recovery-codes", { method: "POST", cookie: c.cookie, data: { password } });
    const codes = generated.data.codes; assert.equal(codes.length, 8); assert.equal(new Set(codes).size, 8);
    const stored = (await owner.query('SELECT "codeHash" FROM inrole.recovery_codes WHERE "userId"=$1', [c.id])).rows;
    assert.ok(stored.every(row => /^[a-f0-9]{64}$/.test(row.codeHash) && !codes.includes(row.codeHash)));
    const newPassword = "  " + randomBytes(18).toString("base64url") + "  ";
    const payload = { handle: c.handle, code: codes[0], newPassword };
    const races = await Promise.all([first, second].map(origin => fetch(origin + "/api/v1/auth/recover", { method: "POST", headers: { Origin: trustedOrigin, "Content-Type": "application/json" }, body: JSON.stringify(payload) })));
    assert.deepEqual(races.map(row => row.status).sort(), [200, 401]);
    await call(first, "preferences", { cookie: c.cookie, status: 401 });
    await request(first, "/api/v1/auth/login", { method: "POST", data: { handle: c.handle, password: newPassword.trim() }, status: 401 });
    await request(first, "/api/v1/auth/login", { method: "POST", data: { handle: c.handle, password: newPassword } });
    await request(first, "/api/v1/auth/recover", { method: "POST", data: payload, status: 401 });
  });
  await scenario("hidden posts vanish from direct URLs, quotes, comments, media, hot lists and recommendations", async () => {
    quote = (await create(b, { quotePostId: post.id, body: "引用测试" })).data;
    await admin("post.hide", post.id, {}); await admin("post.hide", image.post, {});
    await call(first, `posts/${post.id}`, { status: 404 }); await call(first, `posts/${post.id}/comments`, { status: 404 });
    assert.equal((await call(first, `posts/${quote.id}`)).data.quote.unavailable, true);
    assert.ok(!(await call(first, "trending?window=7d")).data.posts.some(row => row.post.id === post.id));
    assert.ok(!(await call(first, "feed", { cookie: a.cookie })).data.posts.some(row => row.id === post.id));
    assert.equal((await fetch(first + image.url, { headers: { Cookie: b.cookie } })).status, 404);
    await admin("report.resolve", report.id, { status: "RESOLVED" });
  });
  await scenario("bans revoke existing credentials and unbanning never restores them", async () => {
    await admin("user.status", b.id, { status: "BANNED" });
    await call(second, "claim", { method: "POST", cookie: b.cookie, data: {}, status: 403 });
    await admin("user.status", b.id, { status: "ACTIVE" });
    await call(second, "claim", { method: "POST", cookie: b.cookie, data: {}, status: 401 });
    assert.ok((await call(first, "admin", { cookie: moderator.cookie })).data.audit.length >= 7);
    await assert.rejects(application.query("UPDATE inrole.app_users SET role='ADMIN' WHERE id=$1", [a.id]), error => error.code === "42501");
  });
  await scenario("banned authors' posts disappear from quotes, media and interactions and return after unban", async () => {
    const signup = await request(first, "/api/v1/auth/register", { method: "POST", data: { handle: "ban_target", password }, status: 201 });
    const target = (await owner.query("SELECT id FROM inrole.app_users WHERE handle='ban_target'")).rows[0];
    const who = { ...target, handle: "ban_target", cookie: signup.cookie };
    await call(first, "preferences", { method: "PUT", cookie: who.cookie, data: { interestIds: [], finishOnboarding: true } });
    const form = new FormData(); form.append("file", new Blob([await sharp({ create: { width: 6, height: 6, channels: 3, background: "green" } }).png().toBuffer()], { type: "image/png" }), "ban.png");
    const media = (await call(first, "media", { method: "POST", cookie: who.cookie, raw: form, status: 201 })).data;
    const own = (await create(who, { body: "封禁前的帖子", mediaIds: [media.id] })).data;
    const quoting = (await create(e, { quotePostId: own.id, body: "引用仍在" })).data;
    assert.equal((await call(first, `posts/${quoting.id}`)).data.quote.unavailable, false);
    assert.equal((await fetch(first + media.url)).status, 200);
    await admin("user.status", who.id, { status: "BANNED" });
    await call(first, `posts/${own.id}`, { status: 404 });
    assert.equal((await call(first, `posts/${quoting.id}`)).data.quote.unavailable, true);
    assert.equal((await fetch(first + media.url)).status, 404);
    await call(first, `posts/${own.id}/comments`, { status: 404 });
    await call(first, `posts/${own.id}/like`, { method: "PUT", cookie: e.cookie, data: { liked: true }, status: 404 });
    await call(first, `posts/${own.id}/comments`, { method: "POST", cookie: e.cookie, data: { personId: "wukong", body: "封禁后评论" }, key: randomUUID(), status: 404 });
    await call(first, `posts/${own.id}/gift`, { method: "POST", cookie: e.cookie, key: randomUUID(), data: { amount: 1 }, status: 404 });
    await call(first, "posts", { method: "POST", cookie: e.cookie, key: randomUUID(), data: { personId: "libai", body: "封禁后引用", quotePostId: own.id }, status: 404 });
    assert.ok(!(await call(first, "posts?limit=50")).data.some(row => row.id === own.id));
    assert.ok(!(await call(first, "feed", { cookie: e.cookie })).data.posts.some(row => row.id === own.id));
    await admin("user.status", who.id, { status: "ACTIVE" });
    assert.equal((await call(first, `posts/${own.id}`)).data.id, own.id);
    assert.equal((await call(first, `posts/${quoting.id}`)).data.quote.unavailable, false);
    assert.equal((await fetch(first + media.url)).status, 200);
  });
  await scenario("public users and own activity expose no private wallet, role or credentials", async () => {
    const user = (await call(first, `users/${a.handle}`)).data; assert.deepEqual(Object.keys(user).sort(), ["bio", "displayName", "handle"]);
    const data = (await call(first, "activity", { cookie: a.cookie })).data;
    assert.ok(data.posts.every(row => row.id !== otherPost.id)); assert.ok(!JSON.stringify(data).includes("passwordHash"));
  });
  await scenario("database disconnect rejects community reads and writes and recovers without losing sessions", async () => {
    faultProxy = await databaseFaultProxy(config.port);
    const proxyUrl = new URL(app); proxyUrl.port = String(faultProxy.port);
    const faultOrigin = await start(proxyUrl.href);
    assert.ok((await call(faultOrigin, "feed")).data.posts.length);
    const before = await call(first, "wallet", { cookie: e.cookie });
    faultProxy.setOffline(true);
    for (const path of ["feed", "posts", "trending", "wallet", "preferences", "activity", "admin"]) await call(faultOrigin, path, { cookie: path === "admin" ? moderator.cookie : e.cookie, status: 503 });
    await call(faultOrigin, "posts", { method: "POST", cookie: e.cookie, key: randomUUID(), data: { personId: "libai", body: "must not be committed offline" }, status: 503 });
    await call(faultOrigin, "preferences", { method: "PUT", cookie: e.cookie, data: { interestIds: ["science"], finishOnboarding: true }, status: 503 });
    await call(faultOrigin, "people/newton/tip", { method: "POST", cookie: e.cookie, key: randomUUID(), data: { amount: 1 }, status: 503 });
    await call(faultOrigin, "admin", { method: "POST", cookie: moderator.cookie, data: { action: "topic.save", targetId: "offline-topic", reason: "test", value: { name: "must not save", description: "", active: true } }, status: 503 });
    assert.equal((await call(first, "wallet", { cookie: e.cookie })).data.balance, before.data.balance);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM inrole.posts WHERE body='must not be committed offline'")).rows[0].count, 0);
    faultProxy.setOffline(false);
    assert.equal((await call(faultOrigin, "wallet", { cookie: e.cookie })).data.balance, before.data.balance);
  });
  await scenario("lost HTTP success response can be retried without duplicate debit or publication", async () => {
    let forwarded;
    droppedResponseProxy = http.createServer(async (req, res) => {
      try { const chunks = []; for await (const chunk of req) chunks.push(chunk); const response = await fetch(first + req.url, { method: req.method, headers: { Origin: trustedOrigin, Cookie: e.cookie, "Content-Type": "application/json", "Idempotency-Key": req.headers["idempotency-key"] }, body: Buffer.concat(chunks) }); forwarded = { status: response.status, body: await response.json() }; res.destroy(); } catch { res.destroy(); }
    });
    await new Promise(resolve => droppedResponseProxy.listen(0, "127.0.0.1", resolve)); const origin = `http://127.0.0.1:${droppedResponseProxy.address().port}`;
    const key = randomUUID(), amount = 2;
    const before = (await call(first, "wallet", { cookie: e.cookie })).data.balance;
    await assert.rejects(fetch(origin + "/api/v1/community/people/newton/tip", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ amount }), signal: AbortSignal.timeout(10000) }));
    assert.equal(forwarded.status, 200);
    const retry = await call(second, "people/newton/tip", { method: "POST", cookie: e.cookie, key, data: { amount } });
    assert.equal(retry.data.id, forwarded.body.data.id); assert.equal((await call(first, "wallet", { cookie: e.cookie })).data.balance, String(BigInt(before) - BigInt(amount)));
    const postKey = randomUUID(), data = { personId: "libai", body: "lost response publication" };
    await assert.rejects(fetch(origin + "/api/v1/community/posts", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": postKey }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) }));
    const again = await create(e, data, postKey, second); assert.equal(again.data.id, forwarded.body.data.id);
    assert.equal((await owner.query('SELECT count(*)::integer AS count FROM inrole.posts WHERE "authorId"=$1 AND body=$2', [e.id, data.body])).rows[0].count, 1);
  });

  await scenario("release root, isolated demo, public policies and health endpoints are available", async () => {
    const home=await fetch(first+'/'); const html=await home.text(); assert.equal(home.status,200); assert.ok(html.includes('入戏社区')); assert.ok(!html.includes('前端演示体验'));
    const demo=await fetch(first+'/demo'); assert.equal(demo.status,200); assert.ok((await demo.text()).includes('前端演示'));
    for(const page of ['privacy','terms','contact','delete-account']) {const r=await fetch(first+'/'+page);assert.equal(r.status,200);const text=await r.text();assert.ok(text.includes('Jasper Lv')||text.includes('jasperlvv@gmail.com'));}
    for(const endpoint of ['health','ready']){const r=await fetch(first+'/api/'+endpoint);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');}
  });
  const privacy=[];
  for(const handle of ['privacy_actor','privacy_other']) {
    const r=await request(first,'/api/v1/auth/register',{method:'POST',data:{handle,password},status:201});
    const id=(await owner.query('SELECT id FROM inrole.app_users WHERE handle=$1',[handle])).rows[0].id;
    privacy.push({id,handle,cookie:r.cookie});await call(first,'preferences',{method:'PUT',cookie:r.cookie,data:{interestIds:[],finishOnboarding:true}});
  }
  const [pa,pb]=privacy;
  const privateImageForm=new FormData();privateImageForm.set('file',new Blob([await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer()],{type:'image/png'}),'private-original.png');
  const privateImage=(await call(first,'media',{method:'POST',cookie:pa.cookie,raw:privateImageForm,status:201})).data;
  const paPost=(await create(pa,{body:'privacy body to erase',mediaIds:[privateImage.id],poll:{question:'private poll question',options:['private first','private second'],durationDays:1}})).data;
  const pbPost=(await create(pb,{body:'other account remains'})).data;
  const paComment=(await call(first,'posts/'+pbPost.id+'/comments',{method:'POST',cookie:pa.cookie,key:randomUUID(),data:{personId:'wukong',body:'private comment'},status:201})).data;
  const quoted=(await create(pb,{body:'quote remains but original disappears',quotePostId:paPost.id})).data;
  await call(first,'people/newton/review',{method:'PUT',cookie:pa.cookie,data:{score:4,body:'private review'}});
  await scenario("blocking is private, persists across instances and hides content, quotes and media",async()=>{
    await call(first,'blocks',{status:401}); await call(first,'blocks/privacy_actor',{method:'PUT',cookie:pa.cookie,data:{},status:400});
    await call(first,'blocks/privacy_other',{method:'PUT',cookie:pa.cookie,data:{}});
    assert.equal((await call(second,'blocks',{cookie:pa.cookie})).data[0].handle,pb.handle);
    assert.equal((await call(first,'blocks',{cookie:pb.cookie})).data.length,0);
    await call(first,'posts/'+paPost.id,{cookie:pb.cookie,status:404});
    await call(second,'posts/'+pbPost.id,{cookie:pa.cookie,status:404});
    assert.ok(!(await call(first,'posts?limit=50',{cookie:pb.cookie})).data.some(p=>p.id===paPost.id));
    assert.ok(!(await call(first,'feed',{cookie:pb.cookie})).data.posts.some(p=>p.id===paPost.id));
    assert.equal((await call(first,'posts/'+quoted.id,{cookie:pb.cookie})).data.quote.unavailable,true);
    assert.ok(!(await call(first,'posts/'+pbPost.id+'/comments',{cookie:pb.cookie})).data.some(c=>c.id===paComment.id));
    assert.ok(!(await call(first,'people/newton/reviews',{cookie:pb.cookie})).data.reviews.some(r=>r.author.handle===pa.handle));
    await call(first,'media/'+privateImage.id,{cookie:pb.cookie,status:404});
    assert.equal((await call(first,'posts/'+paPost.id)).data.id,paPost.id); // Public is still public to guests.
  });
  await scenario("blocked accounts cannot bypass interaction rules by changing figures or endpoints",async()=>{
    for(const [suffix,method,data] of [['comments','POST',{personId:'newton',body:'bypass'}],['like','PUT',{liked:true}],['vote','POST',{optionId:randomUUID()}],['gift','POST',{amount:1}]])await call(first,'posts/'+paPost.id+'/'+suffix,{method,cookie:pb.cookie,key:randomUUID(),data,status:403});
    await call(first,'posts',{method:'POST',cookie:pb.cookie,key:randomUUID(),data:{personId:'newton',body:'bypass quote',quotePostId:paPost.id},status:403});
    await call(first,'blocks/privacy_other',{method:'DELETE',cookie:pa.cookie,data:{}});
    assert.equal((await call(second,'posts/'+paPost.id,{cookie:pb.cookie})).data.id,paPost.id);
    await call(first,'posts/'+paPost.id+'/gift',{method:'POST',cookie:pb.cookie,key:randomUUID(),data:{amount:1}});
    await call(first,'reports',{method:'POST',cookie:pb.cookie,key:randomUUID(),data:{kind:'post',targetId:paPost.id,reason:'deletion test'},status:201});
    await call(first,'reports',{method:'POST',cookie:pb.cookie,key:randomUUID(),data:{kind:'review',targetId:(await owner.query('SELECT id FROM inrole.person_reviews WHERE "userId"=$1',[pa.id])).rows[0].id,reason:'review reference'},status:201});
  });
  await scenario("account deletion validates password and confirmation and rolls back on failure",async()=>{
    await request(first,'/api/v1/auth/delete-account',{method:'POST',data:{password,confirmation:'注销我的账号'},status:401});
    await request(first,'/api/v1/auth/delete-account',{method:'POST',cookie:pa.cookie,data:{password,confirmation:'wrong'},status:400});
    await request(first,'/api/v1/auth/delete-account',{method:'POST',cookie:pa.cookie,data:{password:'incorrect password',confirmation:'注销我的账号'},status:400});
    assert.equal((await call(first,'posts/'+paPost.id)).data.id,paPost.id);
    await owner.query("CREATE FUNCTION inrole.test_erase_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'erasure rollback test'; END $$; CREATE TRIGGER test_erase_failure BEFORE DELETE ON inrole.password_credentials FOR EACH ROW EXECUTE FUNCTION inrole.test_erase_failure()");
    try{await request(first,'/api/v1/auth/delete-account',{method:'POST',cookie:pa.cookie,data:{password,confirmation:'注销我的账号'},status:500});}finally{await owner.query('DROP TRIGGER test_erase_failure ON inrole.password_credentials; DROP FUNCTION inrole.test_erase_failure()');}
    assert.equal((await call(second,'posts/'+paPost.id)).data.id,paPost.id);assert.equal((await owner.query('SELECT status FROM inrole.app_users WHERE id=$1',[pa.id])).rows[0].status,'ACTIVE');
  });
  await scenario("permanent erasure removes identity, credentials, content, polls and media without rewriting ledgers",async()=>{
    await call(first,'requests',{method:'POST',cookie:pa.cookie,data:{name:'private proposal',bio:'private request text'},status:201});
    await request(first,'/api/v1/auth/recovery-codes',{method:'POST',cookie:pa.cookie,data:{password}});
    await request(first,'/api/v1/me',{method:'PATCH',cookie:pa.cookie,data:{displayName:'private display',bio:'private biography'}});
    const secondSession=await request(second,'/api/v1/auth/login',{method:'POST',data:{handle:pa.handle,password}});
    const balance=(await call(first,'wallet',{cookie:pb.cookie})).data.balance;
    const ledger=(await owner.query('SELECT count(*)::int AS n FROM inrole.coin_entries')).rows[0].n;
    await request(first,'/api/v1/auth/delete-account',{method:'POST',cookie:pa.cookie,data:{password,confirmation:'注销我的账号'}});
    for(const cookie of [pa.cookie,secondSession.cookie])await request(second,'/api/v1/me',{cookie,status:401});
    await request(first,'/api/v1/auth/login',{method:'POST',data:{handle:pa.handle,password},status:401});
    await request(first,'/api/v1/auth/register',{method:'POST',data:{handle:pa.handle,password},status:409});
    await call(first,'posts/'+paPost.id,{status:404});await call(first,'users/'+pa.handle,{status:404});await call(first,'media/'+privateImage.id,{status:404});
    assert.equal((await call(first,'posts/'+quoted.id)).data.quote.unavailable,true);
    const row=(await owner.query('SELECT handle,"displayName",bio,status FROM inrole.app_users WHERE id=$1',[pa.id])).rows[0];assert.equal(JSON.parse(await fs.readFile(path.join(mediaRoot,'.receipts',pa.id+'.json'),'utf8')).userId,pa.id);assert.equal(row.status,'CLOSED');assert.notEqual(row.handle,pa.handle);assert.equal(row.bio,'');assert.equal(row.displayName,'已注销用户');
    for(const table of ['password_credentials','auth_sessions','recovery_codes','user_interests','user_recent_people','write_requests'])assert.equal((await owner.query('SELECT count(*)::int AS n FROM inrole.'+table+' WHERE "userId"=$1',[pa.id])).rows[0].n,0);
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM inrole.character_requests WHERE "userId"=$1 AND status='PENDING'`,[pa.id])).rows[0].n,0);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM inrole.polls WHERE "postId"=$1',[paPost.id])).rows[0].n,0);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM inrole.coin_entries')).rows[0].n,ledger);assert.equal((await call(first,'wallet',{cookie:pb.cookie})).data.balance,balance);
    const media=(await owner.query('SELECT "storageKey",bucket,status FROM inrole.media_assets WHERE id=$1',[privateImage.id])).rows[0];assert.equal(media.status,'DELETED');assert.equal(media.bucket,'purged');await assert.rejects(fs.stat(path.join(mediaRoot,media.storageKey)));
    await assert.rejects(owner.query('UPDATE inrole.app_users SET status=\'ACTIVE\' WHERE id=$1',[pa.id]));
    await application.query('BEGIN');try{await application.query("SELECT set_config('inrole.erasing_account',$1,true)",[pb.id]);await assert.rejects(application.query('UPDATE inrole.app_users SET handle=\'forged\' WHERE id=$1',[pb.id]));}finally{await application.query('ROLLBACK');}
  });
  await fs.writeFile(path.join(root, "docs/verification/S09-S15-result.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), runtime: "Next.js production / isolated PostgreSQL / two instances / restricted application role", scenarios: results.length, results, productionDeploymentVerified: false }, null, 2) + "\n");
  console.log(`Community verification passed: ${results.length} scenarios`);
} catch (error) { fail(error); }
finally {
  if (droppedResponseProxy) await new Promise(resolve => droppedResponseProxy.close(resolve));
  for (const server of servers) if (server.child.exitCode === null) { const stopped = new Promise(resolve => server.child.once("exit", resolve)); server.child.kill(); await stopped; }
  await faultProxy?.close();
  await application?.end(); await owner?.end();
  if (bootstrap) { if (created && /^inrole_verify_[a-f0-9]{32}$/.test(database)) await bootstrap.query(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`); await bootstrap.end(); }
  await fs.mkdir(path.join(root, ".tmp/community"), { recursive: true });
  for (let i = 0; i < servers.length; i++) await fs.writeFile(path.join(root, `.tmp/community/server-${i}.log`), servers[i].logs);
  // This directory was uniquely created for this run, never points at app media.
  await fs.rm(mediaRoot, { recursive: true, force: true });
}
