import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify, Algorithm, Version } from "@node-rs/argon2";
import { getIronSession } from "iron-session";
import { passwordError } from "../../src/lib/account-rules.ts";

export const probeHashOptions = Object.freeze({
  algorithm: Algorithm.Argon2id,
  version: Version.V0x13,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
});

export function hashProbePassword(password) {
  const issue = passwordError(password);
  if (issue) throw new Error(issue);
  return hash(password, probeHashOptions);
}

export function verifyProbePassword(passwordHash, password) {
  return verify(passwordHash, password);
}

export function probeTokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createProbeToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: probeTokenHash(token) };
}

export function readProbeCookie(cookieStore, password, secure = false) {
  return getIronSession(cookieStore, {
    cookieName: "inrole_s07a_probe",
    password,
    ttl: 7 * 24 * 60 * 60,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure, path: "/" },
  });
}

export function probeSessionIsUsable(record, user, token, now = Date.now()) {
  if (!record || !user || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  if (!/^[a-f0-9]{64}$/.test(record.tokenHash)) return false;
  if (record.userId !== user.id || user.status !== "ACTIVE" || record.revokedAt !== null) return false;
  if (!Number.isInteger(user.authVersion) || record.authVersion !== user.authVersion) return false;
  if (!(record.expiresAt instanceof Date) || !(record.expiresAt.getTime() > now)) return false;
  return timingSafeEqual(Buffer.from(record.tokenHash, "hex"), Buffer.from(probeTokenHash(token), "hex"));
}
