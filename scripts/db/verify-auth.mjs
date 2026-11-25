import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, randomBytes, createHash, createHmac } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { hash, verify } from "@node-rs/argon2";
import { unsealData } from "iron-session";
import pg from "pg";
import { root, state, databaseUrl, connect, migrate, permissions, redact, fail, loadEnvironment } from "./common.mjs";

loadEnvironment();

const trustedOrigin = "https://inrole.test";
const sessionKey = randomBytes(48).toString("base64url");
const rateKey = randomBytes(48).toString("base64url");
const passwords = [];
const password = () => { const value = randomBytes(18).toString("base64url"); passwords.push(value); return value; };
const servers = [];
const results = [];
let admin, owner, database;
let created = false;
const hashOptions = { algorithm: 2, version: 1, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function start(url, extra = {}) {
  const port = await freePort();
  const server = { origin: `http://127.0.0.1:${port}`, logs: "", child: null };
  server.child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production", DATABASE_URL: url, SESSION_PASSWORD: sessionKey, RATE_LIMIT_SECRET: rateKey, APP_ORIGIN: trustedOrigin, TRUSTED_CLIENT_IP_HEADER: "", ...extra },
  });
  servers.push(server);
  for (const stream of [server.child.stdout, server.child.stderr]) stream.on("data", chunk => { server.logs += redact(chunk); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.child.exitCode !== null) throw new Error("Auth verification server exited");
    try { if ((await fetch(server.origin + "/live/login", { signal: AbortSignal.timeout(1000) })).status === 200) return server.origin; } catch { /* Bounded startup retry. */ }
    await delay(250);
  }
  throw new Error("Auth verification server did not start");
}
async function request(origin, resource, options = {}) {
  const headers = { ...(options.data !== undefined || options.raw !== undefined ? { "Content-Type": "application/json" } : {}), ...(options.origin === null ? {} : { Origin: options.origin || trustedOrigin }), ...(options.cookie ? { Cookie: options.cookie } : {}), ...options.headers };
  const response = await fetch(origin + resource, { method: options.method || (options.data !== undefined || options.raw !== undefined ? "POST" : "GET"), headers, body: options.raw !== undefined ? options.raw : options.data !== undefined ? JSON.stringify(options.data) : undefined, signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  const body = JSON.parse(text);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), body.meta.requestId);
  assert.ok(!/passwordHash|tokenHash|authVersion|SESSION_PASSWORD|postgres(?:ql)?:\/\/|PrismaClient|SELECT .+ FROM/i.test(text), "Response exposed internal data");
  for (const value of passwords) assert.ok(!text.includes(value), "Response exposed a password");
  if (options.status !== undefined) assert.equal(response.status, options.status, resource);
  if (options.code) assert.equal(body.error?.code, options.code, resource);
  if (response.status >= 400) { assert.equal(body.ok, false); assert.equal("data" in body, false); }
  else { assert.equal(body.ok, true); assert.equal(body.meta.source, "database"); }
  return { status: response.status, body, setCookie: response.headers.get("set-cookie") || "", cookie: (response.headers.get("set-cookie") || "").split(";")[0], retryAfter: Number(response.headers.get("retry-after")) };
}
async function scenario(name, action) { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
const auth = (origin, name, data, options = {}) => request(origin, `/api/v1/auth/${name}`, { data, ...options });
const profile = (origin, cookie, data, status) => request(origin, "/api/v1/me", { method: "PATCH", cookie, data, status });
async function account(handle) { return (await owner.query('SELECT u.*,c."passwordHash" FROM inrole.app_users u JOIN inrole.password_credentials c ON c."userId"=u.id WHERE u.handle=$1', [handle])).rows[0]; }
async function lockedRequest(userId, initiate, mutate, status) {
  await owner.query("BEGIN");
  try {
    await owner.query("SELECT id FROM inrole.app_users WHERE id=$1 FOR UPDATE", [userId]);
    const pending = initiate();
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const rows = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND application_name='inrole-web' AND wait_event_type='Lock'", [database]);
      if (rows.rows[0].count > 0) { waiting = true; break; }
      await delay(20);
    }
    assert.ok(waiting, "Request did not reach the account lock");
    await mutate(); await owner.query("COMMIT");
    assert.equal((await pending).status, status);
  } catch (error) { await owner.query("ROLLBACK"); throw error; }
}
async function sourceFiles(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(filename));
    else if (/\.(js|map|json)$/.test(entry.name)) output.push(filename);
  }
  return output;
}
try {
  await fs.access(path.join(root, ".next/BUILD_ID"));
  const config = await state();
  admin = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  database = `inrole_verify_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`); created = true;
  await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
  const direct = databaseUrl(config, database, "inrole_migrator");
  const app = databaseUrl(config, database, "inrole_app");
  owner = await connect(direct); await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
  console.log((await migrate(direct)).trim()); await permissions(direct);
  const first = await start(app), second = await start(app);
  const initialPassword = password(), nextPassword = password();
  let primaryCookie, secondCookie, primary;
  await scenario("guest direct writes and simulated identities are rejected", async () => {
    await profile(first, undefined, { displayName: "游客" }, 401);
    await auth(first, "change-password", { oldPassword: initialPassword, newPassword: nextPassword }, { status: 401, code: "UNAUTHENTICATED" });
    await request(first, "/api/v1/me", { data: { displayName: "伪造" }, method: "PATCH", cookie: "inrole-demo-session=administrator", headers: { "X-User-Id": randomUUID() }, status: 401 });
  });
  await scenario("all auth writes reject missing, foreign and sibling origins", async () => {
    for (const endpoint of ["register", "login", "logout", "change-password"]) {
      await auth(first, endpoint, {}, { origin: null, status: 403 });
      await auth(first, endpoint, {}, { origin: "https://evil.test", headers: { "X-Forwarded-Host": "inrole.test" }, status: 403 });
    }
    await auth(first, "login", {}, { headers: { "Sec-Fetch-Site": "same-site" }, status: 403 });
  });
  await scenario("only two signup fields are accepted and request bodies are bounded", async () => {
    for (const extra of [{ email: "not-used@example.invalid" }, { role: "ADMIN" }, { authorId: randomUUID() }, { userId: randomUUID() }]) await auth(first, "register", { handle: "no_extra", password: initialPassword, ...extra }, { status: 400 });
    await request(first, "/api/v1/auth/register", { raw: "{", status: 400 });
    await request(first, "/api/v1/auth/register", { raw: "x".repeat(2049), status: 413 });
    await auth(first, "register", { handle: "no_extra", password: initialPassword }, { headers: { "Content-Type": "text/plain" }, status: 415 });
    await auth(first, "register", { handle: "ab", password: initialPassword }, { status: 400 });
  });
  await scenario("signup normalizes the ID and commits a hash, daily-grant wallet and controlled session", async () => {
    const result = await auth(first, "register", { handle: "  Primary_User  ", password: initialPassword }, { status: 201 });
    primaryCookie = result.cookie;
    assert.equal(result.body.data.handle, "primary_user");
    assert.equal(result.body.data.onboardingComplete, false);
    for (const pattern of [/^__Host-inrole-session=/, /HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\//i, /Max-Age=604740/i]) assert.ok(pattern.test(result.setCookie), "Missing controlled Cookie attribute");
    assert.ok(!/Domain=/i.test(result.setCookie));
    const payload = await unsealData(primaryCookie.slice(primaryCookie.indexOf("=") + 1), { password: sessionKey, ttl: 604800 });
    assert.deepEqual(Object.keys(payload).sort(), ["token", "v"]);
    primary = await account("primary_user");
    assert.equal(primary.role, "USER"); assert.equal(primary.status, "ACTIVE");
    assert.ok(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/.test(primary.passwordHash));
    assert.ok(await verify(primary.passwordHash, initialPassword));
    const wallet = (await owner.query('SELECT balance FROM inrole.wallets WHERE "userId"=$1', [primary.id])).rows[0];
    assert.equal(wallet.balance, "10");
    const session = (await owner.query('SELECT "tokenHash",extract(epoch FROM "expiresAt"-"createdAt")::int AS ttl FROM inrole.auth_sessions WHERE "userId"=$1', [primary.id])).rows[0];
    assert.equal(session.tokenHash, createHash("sha256").update(payload.token).digest("hex"));
    assert.equal(session.ttl, 604800);
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM inrole.coin_operations")).rows[0].count, 1);
  });
  await scenario("concurrent case/space variants create exactly one account and wallet", async () => {
    const racePassword = password();
    const responses = await Promise.all(["Race_User", "race_user", " RACE_USER "].map((handle, index) => auth(index % 2 ? second : first, "register", { handle, password: racePassword })));
    assert.deepEqual(responses.map(value => value.status).sort(), [201, 409, 409]);
    const counts = (await owner.query('SELECT (SELECT count(*)::int FROM inrole.app_users WHERE handle=\'race_user\') AS users,(SELECT count(*)::int FROM inrole.wallets w JOIN inrole.app_users u ON u.id=w."userId" WHERE u.handle=\'race_user\') AS wallets')).rows[0];
    assert.deepEqual(counts, { users: 1, wallets: 1 });
    await auth(second, "register", { handle: "RACE_USER", password: racePassword }, { status: 429, code: "RATE_LIMITED" });
  });
  await scenario("identical passwords receive distinct salts in real stored credentials", async () => {
    await auth(first, "register", { handle: "same_password", password: initialPassword }, { status: 201 });
    const other = await account("same_password");
    assert.ok(other.passwordHash !== primary.passwordHash);
  });
  await scenario("wrong passwords and missing accounts have the same generic rejection", async () => {
    const wrong = password();
    const a = await auth(first, "login", { handle: "primary_user", password: wrong }, { status: 401 });
    const b = await auth(second, "login", { handle: "not_registered", password: wrong }, { status: 401 });
    assert.deepEqual(a.body.error, b.body.error); assert.equal(a.setCookie, ""); assert.equal(b.setCookie, "");
  });
  await scenario("Unicode and surrounding password spaces are preserved", async () => {
    const unicode = `  中文🙂${password()}  `; passwords.push(unicode);
    await auth(first, "register", { handle: "unicode_user", password: unicode }, { status: 201 });
    await auth(second, "login", { handle: "UNICODE_USER", password: unicode }, { status: 200 });
    await auth(first, "login", { handle: "unicode_user", password: unicode.trim() }, { status: 401 });
  });
  await scenario("sessions work across instances and login rotates the current browser session", async () => {
    secondCookie = (await auth(second, "login", { handle: "PRIMARY_USER", password: initialPassword }, { status: 200 })).cookie;
    const rotated = await auth(first, "login", { handle: "primary_user", password: initialPassword }, { cookie: primaryCookie, status: 200 });
    assert.ok(rotated.cookie !== primaryCookie);
    await request(second, "/api/v1/me", { cookie: primaryCookie, status: 401 });
    await request(first, "/api/v1/me", { cookie: secondCookie, status: 200 });
    primaryCookie = rotated.cookie;
  });
  await scenario("logout revokes the server record and old cookies cannot read or write", async () => {
    const result = await auth(second, "logout", {}, { cookie: primaryCookie, status: 200 });
    assert.ok(/Max-Age=0/.test(result.setCookie));
    await request(first, "/api/v1/me", { cookie: primaryCookie, status: 401 });
    await profile(second, primaryCookie, { displayName: "旧会话" }, 401);
    await request(first, "/api/v1/me", { cookie: secondCookie, status: 200 });
    await auth(first, "logout", {}, { cookie: primaryCookie, status: 200 });
    await auth(first, "logout", {}, { status: 200 });
  });
  await scenario("profile writes derive their owner from the session and reject forged authors", async () => {
    await profile(first, secondCookie, { displayName: "真实用户", bio: "仅修改本人" }, 200);
    const other = await account("same_password");
    await profile(second, secondCookie, { displayName: "伪造作者", authorId: other.id }, 400);
    await profile(first, secondCookie, { userId: other.id, role: "ADMIN" }, 400);
    assert.equal((await account("same_password")).displayName, "same_password");
    assert.equal((await account("primary_user")).displayName, "真实用户");
  });
  await scenario("wrong old passwords and forged password owners leave credentials intact", async () => {
    const before = await account("primary_user");
    await auth(first, "change-password", { oldPassword: password(), newPassword: nextPassword }, { cookie: secondCookie, status: 400 });
    await auth(second, "change-password", { oldPassword: initialPassword, newPassword: nextPassword, userId: (await account("same_password")).id }, { cookie: secondCookie, status: 400 });
    const after = await account("primary_user");
    assert.ok(after.passwordHash === before.passwordHash); assert.equal(after.authVersion, before.authVersion);
    await request(first, "/api/v1/me", { cookie: secondCookie, status: 200 });
  });
  await scenario("password changes atomically replace the hash and revoke all devices", async () => {
    const result = await auth(first, "change-password", { oldPassword: initialPassword, newPassword: nextPassword }, { cookie: secondCookie, status: 200 });
    assert.ok(/Max-Age=0/.test(result.setCookie));
    const changed = await account("primary_user");
    assert.equal(changed.authVersion, 2); assert.ok(changed.passwordHash !== primary.passwordHash);
    assert.equal(await verify(changed.passwordHash, initialPassword), false); assert.ok(await verify(changed.passwordHash, nextPassword));
    assert.equal((await owner.query('SELECT count(*)::int AS count FROM inrole.auth_sessions WHERE "userId"=$1 AND "revokedAt" IS NULL', [primary.id])).rows[0].count, 0);
    await profile(second, secondCookie, { displayName: "旧密码会话" }, 401);
    await auth(first, "change-password", { oldPassword: nextPassword, newPassword: password() }, { cookie: secondCookie, status: 401 });
    await auth(second, "login", { handle: "primary_user", password: initialPassword }, { status: 401 });
    secondCookie = (await auth(second, "login", { handle: "primary_user", password: nextPassword }, { status: 200 })).cookie;
  });
  await scenario("concurrent password changes using one old session have exactly one winner", async () => {
    const old = password(), a = password(), b = password();
    const signup = await auth(first, "register", { handle: "change_race", password: old }, { status: 201 });
    const changes = await Promise.all([a, b].map((value, index) => auth(index ? second : first, "change-password", { oldPassword: old, newPassword: value }, { cookie: signup.cookie })));
    assert.deepEqual(changes.map(value => value.status).sort(), [200, 401]);
    const winner = changes[0].status === 200 ? a : b;
    await auth(first, "login", { handle: "change_race", password: old }, { status: 401 });
    await auth(second, "login", { handle: "change_race", password: winner }, { status: 200 });
  });
  await scenario("a login verified before a password change cannot mint a session afterward", async () => {
    const old = password(), fresh = password();
    await auth(first, "register", { handle: "snapshot_race", password: old }, { status: 201 });
    const target = await account("snapshot_race");
    const encoded = await hash(fresh, hashOptions);
    await lockedRequest(target.id, () => auth(second, "login", { handle: "snapshot_race", password: old }), async () => {
      await owner.query('UPDATE inrole.password_credentials SET "passwordHash"=$1,"changedAt"=now() WHERE "userId"=$2', [encoded, target.id]);
      await owner.query('UPDATE inrole.app_users SET "authVersion"="authVersion"+1 WHERE id=$1', [target.id]);
    }, 401);
  });
  await scenario("bans invalidate sessions permanently and unbanning does not revive old cookies", async () => {
    const pass = password();
    const signup = await auth(first, "register", { handle: "banned_user", password: pass }, { status: 201 });
    const target = await account("banned_user");
    await owner.query("UPDATE inrole.app_users SET status='BANNED' WHERE id=$1", [target.id]);
    await profile(second, signup.cookie, { displayName: "封禁写入" }, 403);
    await auth(first, "login", { handle: "banned_user", password: pass }, { status: 401 });
    await owner.query("UPDATE inrole.app_users SET status='ACTIVE' WHERE id=$1", [target.id]);
    await profile(first, signup.cookie, { displayName: "旧会话复活" }, 401);
    await auth(second, "login", { handle: "banned_user", password: pass }, { status: 200 });
  });
  await scenario("a queued protected write rechecks revocation under the account lock", async () => {
    const pass = password();
    const signup = await auth(first, "register", { handle: "queued_write", password: pass }, { status: 201 });
    const target = await account("queued_write");
    await lockedRequest(target.id, () => profile(second, signup.cookie, { displayName: "不应保存" }), async () => {
      await owner.query('UPDATE inrole.auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=$1', [target.id]);
    }, 401);
    assert.equal((await account("queued_write")).displayName, "queued_write");
  });
  await scenario("a queued protected write rechecks a concurrent ban", async () => {
    const pass = password();
    const signup = await auth(first, "register", { handle: "queued_ban", password: pass }, { status: 201 });
    const target = await account("queued_ban");
    await lockedRequest(target.id, () => profile(second, signup.cookie, { displayName: "不应保存" }), async () => { await owner.query("UPDATE inrole.app_users SET status='BANNED' WHERE id=$1", [target.id]); }, 403);
    assert.equal((await account("queued_ban")).displayName, "queued_ban");
  });
  await scenario("two instances share atomic login limits and spoofed forwarding headers cannot bypass them", async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => auth(index % 2 ? second : first, "login", { handle: "throttled_user", password: initialPassword }, { headers: { "X-Forwarded-For": `198.51.100.${index + 1}`, "X-Real-IP": `198.51.100.${index + 1}` } })));
    assert.equal(responses.filter(value => value.status === 401).length, 8);
    assert.equal(responses.filter(value => value.status === 429).length, 4);
    assert.ok(responses.filter(value => value.status === 429).every(value => value.retryAfter > 0));
    const key = createHmac("sha256", rateKey).update("auth.login.account.v1\0throttled_user").digest("hex");
    assert.equal((await owner.query('SELECT max(count)::int AS count FROM inrole.rate_limit_buckets WHERE scope=\'auth.login.account.v1\' AND "keyHash"=$1', [key])).rows[0].count, 8);
  });
  await scenario("registration rolls back all account records if wallet creation fails", async () => {
    await owner.query("CREATE FUNCTION inrole.test_wallet_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM inrole.app_users WHERE id=NEW.\"userId\" AND handle='rollback_user') THEN RAISE EXCEPTION 'Test-only wallet failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_wallet_failure BEFORE INSERT ON inrole.wallets FOR EACH ROW EXECUTE FUNCTION inrole.test_wallet_failure()");
    await auth(first, "register", { handle: "rollback_user", password: initialPassword }, { status: 500 });
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM inrole.app_users WHERE handle='rollback_user'")).rows[0].count, 0);
    await owner.query("DROP TRIGGER test_wallet_failure ON inrole.wallets; DROP FUNCTION inrole.test_wallet_failure()");
  });
  await scenario("trusted-proxy and missing-key misconfiguration fail closed", async () => {
    const proxy = await start(app, { TRUSTED_CLIENT_IP_HEADER: "x-real-ip" });
    await auth(proxy, "login", { handle: "primary_user", password: nextPassword }, { status: 503 });
    await auth(proxy, "login", { handle: "proxy_guest", password: initialPassword }, { headers: { "X-Real-IP": "203.0.113.17" }, status: 401 });
    const missing = await start(app, { RATE_LIMIT_SECRET: "" });
    await auth(missing, "register", { handle: "no_key", password: initialPassword }, { status: 503 });
  });
  await scenario("database outages do not claim signup, password or logout success", async () => {
    const offlineUrl = new URL(app); offlineUrl.port = "1";
    const offline = await start(offlineUrl.href);
    await auth(offline, "register", { handle: "offline_user", password: initialPassword }, { status: 503 });
    await auth(offline, "login", { handle: "primary_user", password: nextPassword }, { status: 503 });
    const logout = await auth(offline, "logout", {}, { cookie: secondCookie, status: 503 });
    assert.equal(logout.setCookie, "");
    await auth(offline, "change-password", { oldPassword: nextPassword, newPassword: password() }, { cookie: secondCookie, status: 503 });
    await profile(offline, secondCookie, { displayName: "断连写入" }, 503);
  });
  await scenario("the real registration form contains exactly ID and password inputs", async () => {
    const html = await (await fetch(first + "/live/register")).text();
    assert.equal((html.match(/<input\b/g) || []).length, 2);
    assert.ok(/name="handle"/.test(html) && /name="password"/.test(html));
    assert.ok(!/type="email"/.test(html));
  });
  await scenario("client assets and server logs contain no passwords or auth secrets", async () => {
    for (const filename of await sourceFiles(path.join(root, ".next/static"))) {
      const text = await fs.readFile(filename, "utf8");
      for (const value of [...Object.values(config.passwords), sessionKey, rateKey, process.env.SESSION_PASSWORD, process.env.RATE_LIMIT_SECRET, ...passwords].filter(value => value && value.length >= 16)) assert.ok(!text.includes(value), "Client asset exposed a secret");
    }
    for (const server of servers) for (const value of [...passwords, sessionKey, rateKey]) assert.ok(!server.logs.includes(value), "Server log exposed a secret");
  });
  const report = { date: "2026-11-25", runtime: "Next.js production / PostgreSQL / restricted application role", scenarios: results.length, instancesSharingDatabase: 2, results, actualHttpAuth: true, productionCookieAttributesChecked: true, browserHttpsDeploymentVerified: false, emailRegistrationAdded: false, demoAccountsImported: false, databaseScope: "new isolated temporary database, removed after verification" };
  await fs.writeFile(path.join(root, "docs/verification/S08-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`S08 passed: ${results.length} real authentication integration scenarios.`);
} catch (error) { fail(error); }
finally {
  for (const server of servers) if (server.child.exitCode === null) {
    const stopped = new Promise(resolve => server.child.once("exit", resolve)); server.child.kill(); await stopped;
  }
  await owner?.end();
  if (admin) {
    if (created && /^inrole_verify_[a-f0-9]{32}$/.test(database)) await admin.query(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`);
    await admin.end();
  }
  await fs.mkdir(path.join(root, ".tmp/s08"), { recursive: true });
  for (let index = 0; index < servers.length; index++) await fs.writeFile(path.join(root, `.tmp/s08/server-${index}.log`), servers[index].logs);
}
