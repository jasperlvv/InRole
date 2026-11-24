import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createProbeToken, hashProbePassword, probeSessionIsUsable, readProbeCookie, verifyProbePassword } from "../scripts/s07a/auth-probe.mjs";

function jar() {
  const values = new Map();
  const writes = [];
  return {
    values, writes,
    get(name) { const value = values.get(name); return value ? { name, value } : undefined; },
    set(name, value, options) { writes.push({ name, value, options }); values.set(name, value); },
  };
}

function row(tokenHash) {
  return { userId: "probe-user", tokenHash, authVersion: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
}
const user = { id: "probe-user", status: "ACTIVE", authVersion: 1 };

test("S07A Argon2id verifies the correct password, rejects a wrong one and generates independent salts", async () => {
  const password = randomBytes(18).toString("base64url");
  const first = await hashProbePassword(password);
  const second = await hashProbePassword(password);
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyProbePassword(first, password), true);
  assert.equal(await verifyProbePassword(first, `${password}x`), false);
});

test("S07A password hashing preserves Unicode and surrounding spaces without truncating", async () => {
  const password = ` ${"🦊".repeat(62)} `;
  const encoded = await hashProbePassword(password);
  assert.equal(await verifyProbePassword(encoded, password), true);
  assert.equal(await verifyProbePassword(encoded, password.trim()), false);
  assert.throws(() => hashProbePassword("🦊".repeat(65)));
});

test("S07A iron-session seals only an opaque token and sets HttpOnly, SameSite and HTTPS cookie attributes", async () => {
  const secret = randomBytes(48).toString("base64url");
  const store = jar();
  const session = await readProbeCookie(store, secret, true);
  const { token } = createProbeToken();
  session.token = token;
  await session.save();
  assert.equal(store.writes[0].options.httpOnly, true);
  assert.equal(store.writes[0].options.sameSite, "lax");
  assert.equal(store.writes[0].options.secure, true);
  assert.ok(!store.writes[0].value.includes(token));
  assert.equal((await readProbeCookie(store, secret, true)).token, token);
});

test("S07A an altered cookie cannot supply an authenticated token", async () => {
  const store = jar();
  const secret = randomBytes(48).toString("base64url");
  const session = await readProbeCookie(store, secret);
  session.token = createProbeToken().token;
  await session.save();
  const seal = store.values.get("inrole_s07a_probe");
  const at = Math.floor(seal.length / 2);
  store.values.set("inrole_s07a_probe", seal.slice(0, at) + (seal[at] === "a" ? "b" : "a") + seal.slice(at + 1));
  assert.equal((await readProbeCookie(store, secret)).token, undefined);
});

test("S07A record policy rejects revoked, expired, foreign, banned and old-version sessions", () => {
  const { token, tokenHash } = createProbeToken();
  const record = row(tokenHash);
  assert.equal(probeSessionIsUsable(record, user, token), true);
  assert.equal(probeSessionIsUsable({ ...record, revokedAt: new Date() }, user, token), false);
  assert.equal(probeSessionIsUsable({ ...record, expiresAt: new Date(0) }, user, token), false);
  assert.equal(probeSessionIsUsable(record, { ...user, id: "someone-else" }, token), false);
  assert.equal(probeSessionIsUsable(record, { ...user, status: "BANNED" }, token), false);
  assert.equal(probeSessionIsUsable(record, { ...user, authVersion: 2 }, token), false);
  assert.equal(probeSessionIsUsable(record, user, createProbeToken().token), false);
  assert.equal(probeSessionIsUsable(record, user, "not-a-token"), false);
});

test("S07A database revocation policy rejects replay even when an old encrypted cookie can still be read", async () => {
  const store = jar();
  const secret = randomBytes(48).toString("base64url");
  const { token, tokenHash } = createProbeToken();
  const session = await readProbeCookie(store, secret);
  session.token = token;
  await session.save();
  const original = store.values.get("inrole_s07a_probe");
  session.destroy();
  assert.equal(store.writes.at(-1).options.maxAge, 0);
  store.values.set("inrole_s07a_probe", original);
  const replay = await readProbeCookie(store, secret);
  assert.equal(replay.token, token);
  assert.equal(probeSessionIsUsable({ ...row(tokenHash), revokedAt: new Date() }, user, replay.token), false);
});

test("S07A cookie key rotation can accept an existing key and issue under the new key", async () => {
  const oldKey = randomBytes(48).toString("base64url");
  const newKey = randomBytes(48).toString("base64url");
  const store = jar();
  const session = await readProbeCookie(store, { 1: oldKey });
  session.token = createProbeToken().token;
  await session.save();
  const rotated = await readProbeCookie(store, { 2: newKey, 1: oldKey });
  assert.equal(rotated.token, session.token);
  await rotated.save();
  assert.equal((await readProbeCookie(store, { 2: newKey })).token, session.token);
});
