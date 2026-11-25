import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { ApiProblem } from "./errors";
import type { Prisma } from "@/generated/prisma/client";

export const SESSION_TTL = 7 * 86400;
export const sessionCookieName = () => process.env.NODE_ENV === "production" ? "__Host-inrole-session" : "inrole-dev-session";
export function sessionPassword() {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "账号服务尚未配置。");
  return password;
}
const cookieAttributes = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function cookieToken(): Promise<string | null> {
  const sealed = (await cookies()).get(sessionCookieName())?.value;
  if (!sealed) return null;
  const password = sessionPassword();
  try {
    const session = await unsealData<{ v?: number; token?: string }>(sealed, { password, ttl: SESSION_TTL });
    return session.v === 1 && typeof session.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(session.token) ? session.token : null;
  } catch { return null; }
}
export async function prepareSession() {
  const token = randomBytes(32).toString("base64url");
  const sealed = await sealData({ v: 1, token }, { password: sessionPassword(), ttl: SESSION_TTL });
  return { hash: tokenHash(token), sealed };
}
export async function createSession(tx: Prisma.TransactionClient, userId: string, authVersion: number, hash: string) {
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  await tx.authSession.create({ data: { userId, authVersion, tokenHash: hash, createdAt: clock.now, lastSeenAt: clock.now, expiresAt: new Date(clock.now.getTime() + SESSION_TTL * 1000) } });
}
export async function setSessionCookie(sealed: string) {
  (await cookies()).set(sessionCookieName(), sealed, { ...cookieAttributes(), maxAge: SESSION_TTL - 60 });
}
export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName(), "", { ...cookieAttributes(), maxAge: 0, expires: new Date(0) });
}
