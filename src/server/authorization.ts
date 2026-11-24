import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { unsealData } from "iron-session";
import { database } from "./database";
import { ApiProblem } from "./errors";

export type Actor = { userId: string; role: "USER" | "ADMIN" };
export type Access = "public" | "user" | "admin";
export const sessionCookieName = () => process.env.NODE_ENV === "production" ? "__Host-inrole-session" : "inrole-dev-session";
export async function authorize(access: Access): Promise<Actor | null> {
  if (access === "public") return null;
  const sealed = (await cookies()).get(sessionCookieName())?.value;
  const unauthenticated = () => new ApiProblem(401, "UNAUTHENTICATED", "请先登录真实账号。");
  if (!sealed) throw unauthenticated();
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32) throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "账号服务尚未配置。");
  let session: { v?: number; token?: string };
  try { session = await unsealData(sealed, { password, ttl: 7 * 86400 }); }
  catch { throw unauthenticated(); }
  if (session.v !== 1 || typeof session.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(session.token)) throw unauthenticated();
  const record = await database().authSession.findUnique({
    where: { tokenHash: createHash("sha256").update(session.token).digest("hex") },
    select: { expiresAt: true, revokedAt: true, authVersion: true, user: { select: { id: true, role: true, status: true, authVersion: true } } },
  });
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now() || record.authVersion !== record.user.authVersion) throw unauthenticated();
  if (record.user.status !== "ACTIVE") throw new ApiProblem(403, "FORBIDDEN", "当前账号无法执行此操作。");
  if (access === "admin" && record.user.role !== "ADMIN") throw new ApiProblem(403, "FORBIDDEN", "此操作需要管理员权限。");
  return { userId: record.user.id, role: record.user.role };
}
export async function authorizeWrite(request: Request): Promise<Actor> {
  const actor = await authorize("user");
  let origin: string;
  try { origin = new URL(process.env.APP_ORIGIN || "").origin; }
  catch { throw new ApiProblem(503, "SERVICE_UNAVAILABLE", "网站来源尚未配置。"); }
  if (request.headers.get("origin") !== origin) throw new ApiProblem(403, "FORBIDDEN", "请求来源不被允许。");
  return actor!;
}
