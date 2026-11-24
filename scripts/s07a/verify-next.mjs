import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
const fixture = await fs.mkdtemp(path.join(root, ".tmp/s07a-next-"));
const relative = (target) => path.relative(path.join(fixture, "app/api/probe"), target).split(path.sep).join("/");
const corePath = relative(path.join(root, "scripts/s07a/auth-probe.mjs"));
const rulesPath = relative(path.join(root, "src/lib/account-rules.ts"));
const clientPath = relative(path.join(root, "src/generated/prisma/client.ts"));
const route = `import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '${clientPath}';
import { normalizeHandle, handleError, passwordError } from '${rulesPath}';
import { createProbeToken, hashProbePassword, verifyProbePassword, readProbeCookie, probeSessionIsUsable, probeTokenHash } from '${corePath}';
export const runtime = 'nodejs';
const records = new Map();
const user = { id: 'fixture-user', status: 'ACTIVE', authVersion: 1 };
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://unused:unused@127.0.0.1:1/unused', connectionTimeoutMillis: 100 }) });
async function session() { return readProbeCookie(await cookies(), process.env.S07A_PROBE_SECRET); }
export async function POST(request) {
  if (request.headers.get('origin') !== process.env.S07A_EXPECTED_ORIGIN) return Response.json({ error: 'origin' }, { status: 403 });
  const input = await request.json();
  if (typeof input.handle !== 'string' || typeof input.password !== 'string' || handleError(input.handle) || passwordError(input.password)) return Response.json({ error: 'credentials' }, { status: 400 });
  const encoded = await hashProbePassword(input.password);
  if (!await verifyProbePassword(encoded, input.password)) throw new Error('Argon2 verification failed');
  const { token, tokenHash } = createProbeToken();
  records.set(tokenHash, { userId: user.id, tokenHash, authVersion: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60000) });
  const cookie = await session(); cookie.token = token; await cookie.save();
  return Response.json({ handle: normalizeHandle(input.handle), fields: Object.keys(input).sort(), prismaLoaded: Boolean(client.user), databaseConnected: false });
}
export async function GET() {
  const cookie = await session();
  const record = typeof cookie.token === 'string' ? records.get(probeTokenHash(cookie.token)) : null;
  return Response.json({ authorized: probeSessionIsUsable(record, user, cookie.token) }, { status: probeSessionIsUsable(record, user, cookie.token) ? 200 : 401 });
}
export async function DELETE(request) {
  if (request.headers.get('origin') !== process.env.S07A_EXPECTED_ORIGIN) return Response.json({ error: 'origin' }, { status: 403 });
  const cookie = await session();
  if (typeof cookie.token === 'string') { const record = records.get(probeTokenHash(cookie.token)); if (record) record.revokedAt = new Date(); }
  cookie.destroy(); return Response.json({ revoked: true });
}`;
await fs.mkdir(path.join(fixture, "app/api/probe"), { recursive: true });
await fs.writeFile(path.join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
await fs.writeFile(path.join(fixture, "next.config.mjs"), `export default { devIndicators:false, serverExternalPackages:['@node-rs/argon2'], turbopack:{root:${JSON.stringify(root)}} };`);
await fs.writeFile(path.join(fixture, "app/layout.jsx"), "export default function Layout({children}){return <html><body>{children}</body></html>}");
await fs.writeFile(path.join(fixture, "app/page.jsx"), "export default function Page(){return <main>S07A compatibility fixture. No database or production authentication.</main>}");
await fs.writeFile(path.join(fixture, "app/api/probe/route.js"), route.replace("import { randomBytes } from 'node:crypto';\n", ""));
const environment = { ...process.env, S07A_PROBE_SECRET: randomBytes(48).toString("base64url"), NEXT_TELEMETRY_DISABLED: "1" };
const logs = [];
const versions = {};
for (const name of ["next", "iron-session", "@node-rs/argon2", "prisma", "@prisma/client", "@prisma/adapter-pg", "pg"]) {
  versions[name] = JSON.parse(await fs.readFile(path.join(root, "node_modules", name, "package.json"), "utf8")).version;
}
assert.equal(versions.prisma, versions["@prisma/client"]);
assert.equal(versions.prisma, versions["@prisma/adapter-pg"]);
const sqlFile = path.join(fixture, "schema-preview.sql");
const diff = spawn(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", path.join(root, "prisma/schema.prisma"), "--script", "--output", sqlFile], {
  cwd: root,
  env: { ...environment, DIRECT_URL: "postgresql://s07a_unused:s07a_unused@127.0.0.1:1/s07a_unused", CI: "1" },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
diff.stdout.on("data", (chunk) => logs.push(chunk.toString()));
diff.stderr.on("data", (chunk) => logs.push(chunk.toString()));
const diffCode = await new Promise((resolve, reject) => { diff.once("error", reject); diff.once("exit", resolve); });
assert.equal(diffCode, 0, logs.join(""));
const sql = await fs.readFile(sqlFile, "utf8");
assert.equal((sql.match(/CREATE TABLE /g) ?? []).length, 31);
assert.ok(sql.includes('"inrole"."auth_sessions"'));
const nextCli = path.join(root, "node_modules/next/dist/bin/next");
function launch(args) {
  const child = spawn(process.execPath, [nextCli, ...args], { cwd: root, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  return child;
}
const build = launch(["build", fixture]);
const buildCode = await new Promise((resolve, reject) => { build.once("error", reject); build.once("exit", resolve); });
assert.equal(buildCode, 0, logs.join(""));
const port = await new Promise((resolve, reject) => {
  const listener = net.createServer(); listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); });
});
const origin = `http://127.0.0.1:${port}`;
environment.S07A_EXPECTED_ORIGIN = origin;
const server = launch(["start", fixture, "--hostname", "127.0.0.1", "--port", String(port)]);
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(logs.join(""));
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Poll the fixture only. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Local compatibility fixture did not start");
  const endpoint = origin + "/api/probe";
  const unauthorized = await fetch(endpoint);
  assert.equal(unauthorized.status, 401);
  const payload = JSON.stringify({ handle: " Probe_User ", password: randomBytes(18).toString("base64url") });
  const crossOrigin = await fetch(endpoint, { method: "POST", headers: { origin: "https://other.invalid", "content-type": "application/json" }, body: payload });
  assert.equal(crossOrigin.status, 403);
  const created = await fetch(endpoint, { method: "POST", headers: { origin, "content-type": "application/json" }, body: payload });
  assert.equal(created.status, 200, await created.clone().text());
  const result = await created.json();
  assert.deepEqual(result.fields, ["handle", "password"]);
  assert.equal(result.handle, "probe_user");
  assert.equal(result.prismaLoaded, true);
  assert.equal(result.databaseConnected, false);
  const setCookie = created.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(";")[0];
  const authorized = await fetch(endpoint, { headers: { cookie } });
  assert.equal(authorized.status, 200);
  const destroyed = await fetch(endpoint, { method: "DELETE", headers: { cookie, origin } });
  assert.equal(destroyed.status, 200);
  assert.match(destroyed.headers.get("set-cookie"), /Max-Age=0/i);
  assert.equal((await fetch(endpoint, { headers: { cookie } })).status, 401);
  const report = { node: process.version, platform: process.platform, versions, schemaSqlPreviewTables: 31, fixtureProductionBuild: "passed", appRouterCookieRoundTrip: "passed", credentials: ["handle", "password"], argon2Native: "passed", generatedPrismaWithPgAdapterLoaded: "passed", crossOriginRejected: true, oldCookieReplayRejectedByMemoryRecord: true, databaseConnected: false, deployed: false };
  await fs.writeFile(path.join(root, `.tmp/s07a/next-compat-${process.versions.node.split(".")[0]}.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.kill();
  await fs.writeFile(path.join(root, `.tmp/s07a/next-compat-${process.versions.node.split(".")[0]}.log`), logs.join(""));
}
