import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { sealData } from "iron-session";
import pg from "pg";
import { root, state, databaseUrl, connect, migrate, permissions, redact, fail } from "./common.mjs";

const servers = [];
const results = [];
let admin;
let owner;
let database;
let unprivilegedRole;
let created = false;
const sessionPassword = randomBytes(32).toString("base64url");
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function start(url) {
  const port = await freePort();
  const server = { child: null, logs: "", origin: `http://127.0.0.1:${port}` };
  server.child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, env: { ...process.env, NODE_ENV: "production", DATABASE_URL: url, SESSION_PASSWORD: sessionPassword }, stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push(server);
  for (const stream of [server.child.stdout, server.child.stderr]) stream.on("data", chunk => { server.logs += redact(chunk); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.child.exitCode !== null) throw new Error(`Verification server exited: ${server.logs}`);
    try {
      const response = await fetch(`${server.origin}/live/people`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) return server.origin;
    } catch { /* Bounded startup retry. */ }
    await delay(250);
  }
  throw new Error(`Verification server did not become ready: ${server.logs}`);
}
async function request(origin, resource, status, code, options) {
  const response = await fetch(origin + resource, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  const body = JSON.parse(text);
  assert.equal(response.status, status, `${resource}: ${text}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), body.meta.requestId);
  assert.match(body.meta.requestId, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(text, /postgres(?:ql)?:\/\/|passwordHash|tokenHash|authVersion|SESSION_PASSWORD|PrismaClient|SELECT .+ FROM/i);
  if (code) { assert.equal(body.ok, false); assert.equal(body.error.code, code); assert.equal("data" in body, false); }
  else { assert.equal(body.ok, true); assert.equal(body.meta.source, "database"); }
  return body;
}
async function scenario(name, action) {
  await action();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function session(userId, changes = {}) {
  const token = randomBytes(32).toString("base64url");
  const { createdAt = new Date(Date.now() - 1000), expiresAt = new Date(Date.now() + 3600000), revokedAt = null, authVersion = 1 } = changes;
  await owner.query('INSERT INTO inrole.auth_sessions (id,"userId","tokenHash","authVersion","createdAt","expiresAt","lastSeenAt","revokedAt") VALUES ($1,$2,$3,$4,$5,$6,$5,$7)', [randomUUID(), userId, createHash("sha256").update(token).digest("hex"), authVersion, createdAt, expiresAt, revokedAt]);
  return `__Host-inrole-session=${await sealData({ v: 1, token }, { password: sessionPassword, ttl: 7 * 86400 })}`;
}
async function files(directory) {
  const output = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) output.push(...await files(filename));
    else if (/\.(js|json|html|map)$/.test(item.name)) output.push(filename);
  }
  return output;
}
try {
  await fs.access(path.join(root, ".next/BUILD_ID"));
  const config = await state();
  admin = await connect(databaseUrl(config, "postgres", "inrole_bootstrap"));
  database = `inrole_verify_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(database)} OWNER inrole_migrator`);
  created = true;
  await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database)} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO inrole_app`);
  const direct = databaseUrl(config, database, "inrole_migrator");
  const app = databaseUrl(config, database, "inrole_app");
  owner = await connect(direct);
  await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
  console.log((await migrate(direct)).trim());
  await permissions(direct);
  const origin = await start(app);
  await scenario("empty database returns an empty list, without demo data", async () => {
    const body = await request(origin, "/api/v1/people", 200);
    assert.deepEqual(body.data, []); assert.equal(body.meta.page.nextCursor, null);
  });
  await owner.query("INSERT INTO inrole.interest_tags (id,name) VALUES ('api-test','接口测试'),('api-inactive','停用分类')");
  await owner.query("UPDATE inrole.interest_tags SET active=false WHERE id='api-inactive'");
  for (const [id, name, active, category] of [["api-a", "测试李白", true, "api-test"], ["api-b", "测试牛顿", true, "api-test"], ["api-c", "测试孙悟空", true, "api-test"], ["api-hidden", "隐藏人物", false, "api-test"], ["api-no-category", "停用分类人物", true, "api-inactive"]]) {
    await owner.query('INSERT INTO inrole.people (id,name,bio,aliases,active,"primaryInterestId","updatedAt") VALUES ($1,$2,\'真实数据库验收资料\',$3,$4,$5,now())', [id, name, ["别名-" + id], active, category]);
  }
  await scenario("public DTO and stable keyset pagination", async () => {
    const first = await request(origin, "/api/v1/people?limit=2", 200);
    assert.deepEqual(first.data.map(item => item.id), ["api-a", "api-b"]);
    assert.deepEqual(Object.keys(first.data[0]).sort(), ["aliases", "avatarUrl", "bio", "id", "interest", "name"]);
    await owner.query("UPDATE inrole.people SET name='改名后的人物' WHERE id='api-b'");
    const second = await request(origin, `/api/v1/people?limit=2&cursor=${first.meta.page.nextCursor}`, 200);
    assert.deepEqual(second.data.map(item => item.id), ["api-c"]);
    assert.equal(second.meta.page.hasMore, false);
    await request(origin, `/api/v1/people?q=changed&cursor=${first.meta.page.nextCursor}`, 400, "BAD_REQUEST");
  });
  await scenario("search, aliases and classification use bound database parameters", async () => {
    const body = await request(origin, "/api/v1/people?q=" + encodeURIComponent("别名-api-a"), 200);
    assert.equal(body.data[0].id, "api-a");
    assert.deepEqual((await request(origin, "/api/v1/people?interest=api-inactive", 200)).data, []);
    assert.deepEqual((await request(origin, "/api/v1/people?q=" + encodeURIComponent("' OR 1=1 --"), 200)).data, []);
  });
  await scenario("invalid, duplicate and unsupported parameters return 400", async () => {
    for (const query of ["limit=0", "limit=51", "limit=1.5", "limit=2&limit=3", "cursor=bad", "order=role"]) await request(origin, `/api/v1/people?${query}`, 400, "BAD_REQUEST");
  });
  await scenario("inactive and missing figures are not publicly readable", async () => {
    await request(origin, "/api/v1/people/api-a", 200);
    await request(origin, "/api/v1/people/api-hidden", 404, "NOT_FOUND");
    await request(origin, "/api/v1/people/api-no-category", 404, "NOT_FOUND");
    await request(origin, "/api/v1/people/missing", 404, "NOT_FOUND");
    await request(origin, "/api/v1/people/INVALID", 400, "BAD_REQUEST");
  });
  await scenario("read-only methods and HEAD/OPTIONS match the contract", async () => {
    await request(origin, "/api/v1/people", 405, "METHOD_NOT_ALLOWED", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    const head = await fetch(`${origin}/api/v1/people`, { method: "HEAD" });
    assert.equal(head.status, 200); assert.equal(await head.text(), "");
    const options = await fetch(`${origin}/api/v1/people`, { method: "OPTIONS" });
    assert.equal(options.status, 204); assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
  });
  const users = {};
  for (const [kind, role, status] of [["user", "USER", "ACTIVE"], ["admin", "ADMIN", "ACTIVE"], ["banned", "USER", "BANNED"]]) {
    users[kind] = randomUUID();
    await owner.query('INSERT INTO inrole.app_users (id,handle,"displayName",role,status,"updatedAt") VALUES ($1,$2,\'隔离测试用户\',$3,$4,now())', [users[kind], `api_${kind}`, role, status]);
  }
  const userCookie = await session(users.user);
  const adminCookie = await session(users.admin);
  const bannedCookie = await session(users.banned);
  await scenario("guest and simulated browser identity cannot access private endpoints", async () => {
    await request(origin, "/api/v1/me", 401, "UNAUTHENTICATED");
    await request(origin, "/api/v1/me", 401, "UNAUTHENTICATED", { headers: { Cookie: "inrole-demo-session=api_admin", "X-User-Id": users.admin } });
    await request(origin, "/api/v1/me", 401, "UNAUTHENTICATED", { headers: { Cookie: "__Host-inrole-session=tampered" } });
  });
  await scenario("real database sessions enforce ownership, bans and administrator access", async () => {
    const self = await request(origin, "/api/v1/me", 200, null, { headers: { Cookie: userCookie } });
    assert.equal(self.data.handle, "api_user");
    await request(origin, "/api/v1/me?userId=" + users.admin, 400, "BAD_REQUEST", { headers: { Cookie: userCookie } });
    await request(origin, "/api/v1/admin/people", 403, "FORBIDDEN", { headers: { Cookie: userCookie } });
    await request(origin, "/api/v1/admin/people", 200, null, { headers: { Cookie: adminCookie } });
    await request(origin, "/api/v1/me", 403, "FORBIDDEN", { headers: { Cookie: bannedCookie } });
  });
  await scenario("revoked, expired and old-version sessions are rejected", async () => {
    const revoked = await session(users.user, { revokedAt: new Date() });
    const expired = await session(users.user, { createdAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() - 3600000) });
    const oldVersion = await session(users.user, { authVersion: 2 });
    for (const cookie of [revoked, expired, oldVersion]) await request(origin, "/api/v1/me", 401, "UNAUTHENTICATED", { headers: { Cookie: cookie } });
  });
  const offlineUrl = new URL(app); offlineUrl.port = "1";
  const offline = await start(offlineUrl.href);
  await scenario("database disconnection returns 503 without data, including authenticated reads", async () => {
    await request(offline, "/api/v1/people", 503, "SERVICE_UNAVAILABLE");
    await request(offline, "/api/v1/me", 503, "SERVICE_UNAVAILABLE", { headers: { Cookie: userCookie } });
  });
  unprivilegedRole = `inrole_probe_${randomBytes(6).toString("hex")}`;
  const restrictedPassword = randomBytes(32).toString("base64url");
  await admin.query(`CREATE ROLE ${pg.escapeIdentifier(unprivilegedRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pg.escapeLiteral(restrictedPassword)}`);
  await admin.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO ${pg.escapeIdentifier(unprivilegedRole)}`);
  const deniedUrl = new URL(app); deniedUrl.username = unprivilegedRole; deniedUrl.password = restrictedPassword;
  const denied = await start(deniedUrl.href);
  await scenario("a database role without schema privileges fails closed", async () => { await request(denied, "/api/v1/people", 503, "SERVICE_UNAVAILABLE"); });
  await scenario("real and demo page entries remain separate", async () => {
    const live = await (await fetch(origin + "/live/people")).text();
    assert.match(live, /入戏社区/); assert.doesNotMatch(live, /非真实账号 · 不保存密码/);
    const root = await (await fetch(origin + "/")).text();
    assert.match(root, /入戏社区/);
    const demo = await (await fetch(origin + "/demo")).text();
    assert.match(demo, /前端演示/);
  });
  await scenario("client bundles contain no local database or session secrets", async () => {
    for (const filename of await files(path.join(root, ".next/static"))) {
      const text = await fs.readFile(filename, "utf8");
      for (const secret of [...Object.values(config.passwords), sessionPassword, restrictedPassword]) assert.equal(text.includes(secret), false, filename);
    }
  });
  const counts = {};
  const dev = await connect(databaseUrl(config, "inrole_dev", "inrole_app"));
  try {
    for (const table of ["app_users", "password_credentials", "wallets", "coin_operations", "coin_entries"]) counts[table] = (await dev.query(`SELECT count(*)::int AS count FROM inrole.${table}`)).rows[0].count;
  } finally { await dev.end(); }
  const report = { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), runtime: "Next.js production / Node.js / PostgreSQL", scenarios: results.length, results, developmentCounts: counts, browserDataImported: false, authenticationTestScope: "session reads; registration and password mutation covered separately by verify:s08" };
  await fs.writeFile(path.join(root, "docs/verification/S07C-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`S07C passed: ${results.length} integration scenarios.`);
} catch (error) { fail(error); }
finally {
  for (const server of servers) {
    if (server.child.exitCode === null) {
      const stopped = new Promise(resolve => server.child.once("exit", resolve));
      server.child.kill(); await stopped;
    }
  }
  await owner?.end();
  if (admin) {
    if (created && /^inrole_verify_[a-f0-9]{32}$/.test(database)) await admin.query(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`);
    if (unprivilegedRole && /^inrole_probe_[a-f0-9]{12}$/.test(unprivilegedRole)) await admin.query(`DROP ROLE ${pg.escapeIdentifier(unprivilegedRole)}`);
    await admin.end();
  }
  await fs.mkdir(path.join(root, ".tmp/s07c"), { recursive: true });
  for (let index = 0; index < servers.length; index++) await fs.writeFile(path.join(root, `.tmp/s07c/server-${index}.log`), servers[index].logs);
}
